from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends, Form, UploadFile, File
from typing import List
from pathlib import Path
import tempfile
import os

from models import Product
from utils.auth import get_current_user
from dal.products_repo import (
    list_products,
    get_product_by_id,
    create_product,
    insert_products,
    update_product as repo_update_product,
    delete_product as repo_delete_product,
    upsert_product_by_sku,
)
from services.data_importer import import_products_from_excel, import_products_from_csv
from dal.inventory_repo import create_inventory

router = APIRouter()


def _normalize_import_doc(doc: dict) -> dict:
    """Normalize raw import doc into a product payload."""
    # Support both standard and Romanian column names
    name = doc.get("name") or doc.get("Denumire")
    sku = doc.get("sku")  # Still allow if present, but optional
    price = doc.get("price") or doc.get("Valoare")
    quantity = doc.get("quantity") or doc.get("Cantitate")
    date = doc.get("date") or doc.get("Data")

    if name is None or price is None:
        raise ValueError("Missing required fields: name/Denumire, price/Valoare")

    try:
        price_val = float(str(price).replace(",", "").replace(" ", ""))
    except Exception:
        raise ValueError(f"Invalid price/Valoare for product {name}")

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
        "price": price_val,
        "category": doc.get("category"),
        "cost": cost_val,
        "user_id": doc.get("user_id"),
        "store_ids": store_ids,
        "abc_classification": doc.get("abc_classification"),
    }
    if quantity is not None:
        try:
            result["quantity"] = float(str(quantity).replace(",", "").replace(" ", ""))
        except Exception:
            pass
    if date is not None:
        result["date"] = date
    return result


@router.get("/", response_model=List[dict])
async def get_products(skip: int = 0, limit: int = 100, current_user: str = Depends(get_current_user)):
    """Get all products with pagination."""
    return list_products(skip=skip, limit=limit)


@router.get("/{product_id}", response_model=dict)
async def get_product(product_id: str, current_user: str = Depends(get_current_user)):
    """Get a specific product by ID."""
    product = get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_product_endpoint(product: Product, current_user: str = Depends(get_current_user)):
    """Create a new product."""
    # Attach current user's store_id if not present
    from dal.stores_repo import get_stores_by_user
    user_stores = get_stores_by_user(current_user)
    if not user_stores:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No store found for current user")
    store_id = user_stores[0]["id"]
    product_dict = product.dict(exclude={"id"})
    product_dict["created_at"] = datetime.utcnow()
    if not product_dict.get("store_ids"):
        product_dict["store_ids"] = [store_id]
    elif store_id not in product_dict["store_ids"]:
        product_dict["store_ids"].append(store_id)
    created = create_product(**product_dict)
    return created


@router.put("/{product_id}", response_model=dict)
async def update_product_endpoint(product_id: str, product: Product, current_user: str = Depends(get_current_user)):
    """Update a product."""
    updates = product.dict(exclude={"id", "created_at"}, exclude_none=True)
    updated = repo_update_product(product_id, updates)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return updated


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_endpoint(product_id: str, current_user: str = Depends(get_current_user)):
    """Delete a product."""
    deleted = repo_delete_product(product_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return None


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_products_endpoint(
    file:UploadFile=File(...), 
    store_id:str=Form(...),
    current_user: str = Depends(get_current_user)
):
    """
    Import products from an Excel or CSV file.
    Expected columns: name, sku, price, (optional) category, cost, store_ids (comma list), user_id
    """
    print("Received store_id:", store_id)
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
        
        # Parse the file based on type
        if is_csv:
            products_data = import_products_from_csv(tmp_file_path)
            file_type = "CSV"
        else:
            products_data = import_products_from_excel(tmp_file_path, sheet_name="Sheet1")
            file_type = "Excel"
        
        print(f"[DEBUG] Parsed {len(products_data)} products from {file_type}")
        print(f"[DEBUG] Sample data: {products_data[:2] if products_data else 'No data'}")
        
        if not products_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No valid products found in the {file_type} file"
            )
        
        import uuid
        successes: list = []
        errors: list = []
        for idx, raw in enumerate(products_data):
            try:
                normalized = _normalize_import_doc(raw)
                # enforce store association
                normalized["store_ids"] = [store_id]

                # normalize SKU: treat '', 'none', 'null' (any case) as missing
                raw_sku = normalized.get("sku")
                if raw_sku is None:
                    is_missing_sku = True
                else:
                    sku_str = str(raw_sku).strip()
                    is_missing_sku = sku_str == "" or sku_str.lower() in ("none", "null")
                if is_missing_sku:
                    normalized["sku"] = f"auto-{uuid.uuid4()}"
                else:
                    normalized["sku"] = sku_str

                try:
                    # Only pass fields expected by create_product
                    product_payload = {
                        "name": normalized.get("name"),
                        "sku": normalized.get("sku"),
                        "price": normalized.get("price"),
                        "category": normalized.get("category"),
                        "cost": normalized.get("cost"),
                        "user_id": normalized.get("user_id"),
                        "store_ids": normalized.get("store_ids"),
                        "abc_classification": normalized.get("abc_classification"),
                    }
                    created = create_product(**product_payload)
                    product_id = created.get("id", None)
                except Exception as e:
                    errors.append({"row": idx + 2, "error": f"Product creation failed: {str(e)}", "data": normalized})
                    continue

                try:
                    # create or update inventory quantity for this product in the store
                   create_inventory(
                        product_id=product_id,
                        store_id=store_id,
                        quantity=normalized.get("quantity", 0)
                    )
                except Exception as e:
                    errors.append({"row": idx + 2, "error": f"Inventory creation failed: {str(e)}", "data": normalized})

                successes.append(product_id)
            except Exception as e:
                errors.append({"row": idx + 2, "error": f"Normalization failed: {str(e)}", "raw": raw})

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
