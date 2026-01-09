import os
from pathlib import Path
import tempfile
import uuid
import pandas as pd
from fastapi import APIRouter, Depends, Query, HTTPException, status, Form, UploadFile, File
from typing import List, Optional
from services.data_importer import import_products_from_csv, import_products_from_excel
from utils.auth import get_current_user
from dal.sales_repo import (
    list_sales,
    get_sales_summary,
    get_sales_by_store,
    get_sales_by_product,
    create_sale as create_sale_record,
)
from dal.products_repo import get_product_by_id, create_product
from database import db
from datetime import datetime, timedelta
from collections import defaultdict

router = APIRouter(tags=["sales"])

sales_collection = db["sales"]
products_collection = db["products"]
inventory_collection = db["inventory"]

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

@router.get("/", response_model=List[dict])
async def get_sales(skip: int = 0, limit: int = 100, days: Optional[int] = None, current_user: str = Depends(get_current_user)):
    """Get all sales, optionally filter by days."""
    print(f"GET /sales - skip={skip}, limit={limit}, days={days}")
    result = list_sales(skip=skip, limit=limit, days=days)
    print(f"list_sales returned {len(result)} sales")
    if result:
        print(f"First sale: {result[0]}")
    return result


@router.get("/summary", response_model=dict)
async def sales_summary(days: int = 30, current_user: str = Depends(get_current_user)):
    """Get sales summary for the last N days."""
    return get_sales_summary(days=days)


@router.get("/monthly")
async def get_monthly_sales(store_id: Optional[str] = Query(None)):
    """Monthly revenue trend for last 6 months. Falls back to direct DB aggregation."""
    query = {"store_id": store_id} if store_id else {}
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    query["date"] = {"$gte": six_months_ago.isoformat()}

    sales = list(sales_collection.find(query))

    monthly_revenue = defaultdict(float)
    for sale in sales:
        try:
            sale_date = datetime.fromisoformat(sale.get("date", ""))
            month_key = sale_date.strftime("%b")
            quantity = sale.get("quantity", 0)
            price = sale.get("price", 0)
            if not price and sale.get("product_id") and products_collection:
                product = products_collection.find_one({"product_id": sale["product_id"]})
                if product:
                    price = product.get("price", 0)
            monthly_revenue[month_key] += quantity * price
        except Exception:
            continue

    months = []
    current_date = datetime.utcnow()
    for i in range(5, -1, -1):
        month_date = current_date - timedelta(days=30 * i)
        month_name = month_date.strftime("%b")
        months.append({"month": month_name, "revenue": int(monthly_revenue.get(month_name, 0))})

    if any(m["revenue"] > 0 for m in months):
        return months
    return []

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


        

@router.post("/")
async def create_sale_legacy(sale: dict):
    """Create a new sale record (legacy direct DB endpoint)."""
    if "date" not in sale:
        sale["date"] = datetime.utcnow().isoformat()
    result = sales_collection.insert_one(sale)
    sale["_id"] = str(result.inserted_id)
    return sale

