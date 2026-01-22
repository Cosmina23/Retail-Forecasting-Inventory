import os
import tempfile
import uuid
from pathlib import Path
from bson import ObjectId
import pandas as pd
from fastapi import APIRouter, Depends, File, Form, Query, HTTPException, UploadFile, status
from typing import List, Optional
from dal.products_repo import create_product, get_product_by_id
from routers.activity import verify_store_ownership
from services.data_importer import import_products_from_csv, import_products_from_excel
from utils.auth import get_current_user
from database import db, sales_collection, products_collection, stores_collection

# Repository (DAL)
from dal.sales_repo import (
    list_sales,
    get_sales_summary,
    get_sales_by_store,
    get_sales_by_product,
    create_sale as create_sale_record,
)
from database import db
from datetime import datetime, timedelta
from collections import defaultdict

def verify_store_ownership(store_id: str, current_user: Optional[dict]) -> tuple[bool, Optional[str]]:
    """
    Verifică dacă magazinul aparține utilizatorului curent.
    Returnează: (este_proprietar, id_ul_real_din_db)
    """
    if not current_user:
        return False, None

    try:
        # Încercăm după _id (ObjectId) sau după câmpul store_id
        if ObjectId.is_valid(store_id):
            store = stores_collection.find_one({"_id": ObjectId(store_id)})
        else:
            store = stores_collection.find_one({"store_id": store_id})

        if not store:
            return False, None

        # Verificăm ownership (comparăm ID-urile ca stringuri)
        is_owner = str(store.get("user_id")) == str(current_user["_id"])
        return is_owner, str(store["_id"])
    except Exception:
        return False, None


router = APIRouter(prefix="/sales", tags=["sales"])


def _normalize_import_doc(doc: dict) -> dict:
    """Normalize raw import doc into a product payload."""
    # Support both standard and Romanian column names
    name = doc.get("name") or doc.get("Denumire")
    sku = doc.get("sku")  # Still allow if present, but optional
    product_id = doc.get("product_id")
    quantity = doc.get("quantity") or doc.get("Cantitate")
    total_amount = doc.get("total_amount") or doc.get("Valoare")
    unit_price = doc.get("unit_price") or doc.get("Pret unitar") or doc.get("price_per_unit")
    date = doc.get("date") or doc.get("Data")

    if name is None or total_amount is None or date is None:
        raise ValueError("Missing required fields: name/Denumire, total_amount/Valoare, date/Data")

    try:
        total_amount_val = float(str(total_amount).replace(",", "").replace(" ", ""))
    except Exception:
        raise ValueError(f"Invalid total_amount/Valoare for product {name}")

    unit_price_val = None
    if unit_price is not None:
        try:
            unit_price_val = float(str(unit_price).replace(",", "").replace(" ", ""))
        except Exception:
            unit_price_val = None

    cost_val = None
    if doc.get("cost") not in (None, "", "null", "None"):
        try:
            cost_val = float(doc.get("cost"))
        except Exception:
            raise ValueError(f"Invalid cost for product {name}")

    store_ids_raw = doc.get("store_ids")
    store_ids: List[str] = []
    if isinstance(store_ids_raw, list):
        store_ids = [str(s).strip() for s in store_ids_raw if str(s).strip()]
    elif isinstance(store_ids_raw, str):
        store_ids = [s.strip() for s in store_ids_raw.split(",") if s.strip()]
    elif store_ids_raw not in (None, "", "null", "None"):
        store_ids = [str(store_ids_raw).strip()]

    # Optionally parse quantity and date if needed for inventory or audit
    result = {
        "name": name,
        "sku": str(sku) if sku is not None else None,
        "product_id": product_id,
        "total_amount": total_amount_val,
        "unit_price": unit_price_val,
        "user_id": doc.get("user_id"),
        "store_ids": store_ids,
        "date": date,
    }
    if quantity is not None:
        try:
            result["quantity"] = float(str(quantity).replace(",", "").replace(" ", ""))
        except Exception:
            pass
    return result


@router.get("/{store_id}", response_model=dict)
async def get_sales(
        store_id:str,
        skip: int = 0,
        limit: int = 100,
        days: Optional[int] = None,
        current_user: dict = Depends(get_current_user)
):
    """
    Obține vânzările. Dacă store_id este furnizat, filtrează și verifică permisiunile.
    Dacă nu, returnează lista generală (pentru admin sau uz general).
    """
    if store_id:
        is_owner, actual_id = verify_store_ownership(store_id, current_user)
        if not is_owner:
            raise HTTPException(status_code=403, detail="Access denied to this store's data")

        # Count total and return paginated items for this store
        query = {"store_id": store_id}
        if days is not None:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query["sale_date"] = {"$gte": cutoff_date}

        total = sales_collection.count_documents(query)
        cursor = sales_collection.find(query).skip(skip).limit(limit)
        items = []
        for doc in cursor:
            items.append(_sanitize_import_doc(doc) if False else doc)
        # Use DAL sanitizer for consistency
        from dal.sales_repo import _sanitize_sale_doc
        items = [_sanitize_sale_doc(d) for d in sales_collection.find(query).skip(skip).limit(limit)]

        return {"total": total, "items": items}

    # Dacă nu e specificat un magazin, returnăm lista generală cu paginare
    query = {}
    if days is not None:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        query["sale_date"] = {"$gte": cutoff_date}

    total = sales_collection.count_documents(query)
    cursor = sales_collection.find(query).skip(skip).limit(limit)
    from dal.sales_repo import _sanitize_sale_doc
    items = [_sanitize_sale_doc(doc) for doc in cursor]
    return {"total": total, "items": items}


@router.get("/summary", response_model=dict)
async def sales_summary(days: int = 30, current_user: dict = Depends(get_current_user)):
    """Obține sumarul vânzărilor pentru ultimele N zile."""
    # În mod normal, aici s-ar adăuga o filtrare per user_id în DAL
    return get_sales_summary(days=days)


@router.get("/monthly")
async def get_monthly_sales(
        store_id: Optional[str] = Query(None),
        current_user: dict = Depends(get_current_user)
):
    """Trendul veniturilor lunare pentru ultimele 6 luni."""
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id is required")

    is_owner, actual_id = verify_store_ownership(store_id, current_user)
    if not is_owner:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Agregare date
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    query = {
        "store_id": actual_id,
        "date": {"$gte": six_months_ago}  # Presupunem format BSON Date conform inventarului
    }

    sales = list(sales_collection.find(query))
    monthly_revenue = defaultdict(float)

    for sale in sales:
        try:
            # Gestionăm atât obiecte datetime cât și string-uri ISO
            d = sale.get("date")
            sale_date = d if isinstance(d, datetime) else datetime.fromisoformat(str(d).replace('Z', '+00:00'))

            month_key = sale_date.strftime("%b")

            # Calculăm venitul
            qty = sale.get("quantity", 0)
            price = sale.get("price", 0)

            # Fallback preț din colecția de produse dacă lipsește în sale
            if not price and sale.get("product_id"):
                prod = products_collection.find_one({"_id": ObjectId(sale["product_id"])})
                if prod:
                    price = prod.get("price", 0)

            monthly_revenue[month_key] += (qty * price)
        except:
            continue

    # Generăm lista pentru ultimele 6 luni (inclusiv cele cu 0)
    result = []
    current_date = datetime.utcnow()
    for i in range(5, -1, -1):
        target_date = current_date - timedelta(days=30 * i)
        m_name = target_date.strftime("%b")
        result.append({
            "month": m_name,
            "revenue": round(monthly_revenue.get(m_name, 0), 2)
        })

    return result

@router.post("/")
async def create_sale(sale: dict, current_user: dict = Depends(get_current_user)):
    """Înregistrează o vânzare nouă."""
    # Asigurăm consistența ID-ului magazinului
    if "store_id" in sale:
        is_owner, actual_id = verify_store_ownership(sale["store_id"], current_user)
        if not is_owner:
            raise HTTPException(status_code=403, detail="Cannot record sale for a store you don't own")
        sale["store_id"] = actual_id

    if "date" not in sale:
        sale["date"] = datetime.utcnow()  # Salvăm ca BSON Date pentru interogări rapide
    elif isinstance(sale["date"], str):
        sale["date"] = datetime.fromisoformat(sale["date"].replace('Z', '+00:00'))

    result = sales_collection.insert_one(sale)
    sale["_id"] = str(result.inserted_id)
    return sale

@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_sales_endpoint(
    file: UploadFile = File(...),
    store_id: str = Form(...),
    current_user: str = Depends(get_current_user)
):
    """
    Import sales from an Excel or CSV file.
    Expected columns: id,product_id,store_id,quantity,total_amount, unit_price, sale_date,day_of_the_week,is_weekend,is_holiday,holiday_name,promotion_id,created_at
    """
    filename_lower = file.filename.lower()
    is_excel = filename_lower.endswith((".xlsx", ".xls"))
    is_csv = filename_lower.endswith(".csv")
    
    if not (is_excel or is_csv):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Excel (.xlsx, .xls) and CSV files are supported"
        )
    
    try:
        # Save uploaded file to a temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        print(f"[DEBUG] Saved file to: {tmp_file_path}")
        print(f"[DEBUG] File type: {'CSV' if is_csv else 'Excel'}")

        if is_csv:
            sales_data = import_products_from_csv(tmp_file_path)
            file_type = "CSV"
        else:
            sales_data = import_products_from_excel(tmp_file_path, sheet_name="Sheet1")
            file_type = "Excel"
        print(f"[DEBUG] Parsed {len(sales_data)} sales from {file_type}")
        print(f"[DEBUG] Sample data: {sales_data[:2] if sales_data else 'No data'}")

        if not sales_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No valid sales found in the {file_type} file"
            )
        successes: list = []
        errors: list = []
        for idx, raw in enumerate(sales_data):
            try:
                normalized = _normalize_import_doc(raw)

                # --- Resolve product ---
                product_id: Optional[str] = None

                # 1) Use provided product_id if valid
                raw_pid = normalized.get("product_id")
                if raw_pid:
                    found = get_product_by_id(str(raw_pid))
                    if found:
                        product_id = found["id"]

                # 2) Otherwise try by name
                if not product_id:
                    name = normalized.get("name")
                    if name:
                        existing = products_collection.find_one({"name": name})
                        if existing:
                            product_id = str(existing.get("_id"))

                # 3) If still missing, create a product
                if not product_id:
                    sku_value = normalized.get("sku")
                    sku_clean = None
                    if sku_value is not None:
                        sku_clean = str(sku_value).strip()
                        if sku_clean == "" or sku_clean.lower() in ("none", "null"):
                            sku_clean = None
                    if not sku_clean:
                        sku_clean = f"auto-{uuid.uuid4()}"

                    unit_price = normalized.get("unit_price")
                    price_for_product = unit_price if unit_price is not None else 0.0

                    created_product = create_product(
                        name=normalized.get("name"),
                        sku=sku_clean,
                        price=price_for_product,
                        category=raw.get("category"),
                        cost=raw.get("cost"),
                        user_id=current_user,
                        store_ids=[store_id],
                        abc_classification=None,
                    )
                    product_id = created_product.get("id")

                if not product_id:
                    raise ValueError("Unable to resolve or create product")

                # --- Build sale payload ---

                qty_raw = normalized.get("quantity", 0)
                try:
                    qty_val = int(float(qty_raw))
                except Exception:
                    qty_val = 0

                # Get total_amount from Excel (Valoare, total_amount, or unit_price for legacy)
                total_amount = (
                    raw.get("total_amount")
                    or raw.get("Valoare")
                    or normalized.get("total_amount")
                    or normalized.get("Valoare")
                    or normalized.get("unit_price")  # fallback for legacy
                )
                try:
                    total_amount_val = float(total_amount) if total_amount is not None else None
                except Exception:
                    total_amount_val = None
                if total_amount_val is None:
                    total_amount_val = 0.0

                # Compute unit_price as total_amount / quantity
                try:
                    unit_price_val = (total_amount_val / qty_val) if qty_val else None
                except Exception:
                    unit_price_val = None

                date_raw = normalized.get("date")
                sale_dt = None
                if isinstance(date_raw, datetime):
                    sale_dt = date_raw
                elif isinstance(date_raw, (int, float)):
                    # Excel serial date (days since 1899-12-30)
                    try:
                        sale_dt = datetime(1899, 12, 30) + pd.to_timedelta(date_raw, unit="D")
                    except Exception:
                        sale_dt = None
                elif isinstance(date_raw, str) and date_raw.strip():
                    # Support Excel formula =DATE(YYYY,MM,DD)
                    import re
                    date_formula = re.match(r"=DATE\((\d{4}),(\d{1,2}),(\d{1,2})\)", date_raw.strip())
                    if date_formula:
                        try:
                            y, m, d = map(int, date_formula.groups())
                            sale_dt = datetime(y, m, d)
                        except Exception:
                            sale_dt = None
                    else:
                        # Try ISO, then pandas, then common formats
                        try:
                            sale_dt = datetime.fromisoformat(date_raw)
                        except Exception:
                            try:
                                sale_dt = pd.to_datetime(date_raw, errors="coerce")
                                if pd.isnull(sale_dt):
                                    sale_dt = None
                                else:
                                    sale_dt = sale_dt.to_pydatetime()
                            except Exception:
                                sale_dt = None
                if sale_dt is None:
                    sale_dt = datetime.utcnow()

                total_amount = raw.get("total_amount")
                try:
                    total_amount_val = float(total_amount) if total_amount is not None else None
                except Exception:
                    total_amount_val = None
                if total_amount_val is None and unit_price_val is not None:
                    total_amount_val = unit_price_val*qty_val
                if total_amount_val is None:
                    total_amount_val = 0.0

                sale_payload = {
                    "product_id": product_id,
                    "store_id": store_id,
                    "quantity": qty_val,
                    "total_amount": total_amount_val,
                    "unit_price": unit_price_val,
                    "sale_date": sale_dt,
                    "day_of_week": sale_dt.strftime("%A") if sale_dt else None,
                    "is_weekend": sale_dt.weekday() >= 5 if sale_dt else None,
                    "is_holiday": raw.get("is_holiday"),
                    "holiday_name": raw.get("holiday_name"),
                    "promotion_id": raw.get("promotion_id"),
                }

                created = create_sale_record(**sale_payload)
                successes.append(created.get("id"))
            except Exception as e:
                errors.append({"row": idx + 2, "error": f"Row failed: {str(e)}", "raw": raw})

        # Return summary
        return {
            "message": f"Successfully processed {len(successes)} rows",
            "inserted_count": len(successes),
            "inserted_ids": successes,
            "errors": errors,
        }
    finally:
        # Clean up temporary file
        if 'tmp_file_path' in locals() and os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)


        