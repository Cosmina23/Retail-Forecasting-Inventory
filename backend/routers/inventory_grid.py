from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
import pandas as pd
from bson import ObjectId
from datetime import datetime, timedelta
from database import db, inventory_collection, products_collection, sales_collection
from dal.inventory_repo import get_inventory_by_store
from dal.sales_repo import get_sales_by_product
from utils.auth import get_current_user

router = APIRouter()


def serialize_mongo(doc):
    if isinstance(doc, list): return [serialize_mongo(i) for i in doc]
    if isinstance(doc, dict):
        return {("id" if k == "_id" else k): (str(v) if isinstance(v, ObjectId) else serialize_mongo(v)) for k, v in
                doc.items()}
    return doc


@router.get("/grid-data/{store_id}")
async def get_inventory_grid(
        store_id: str,
        category: Optional[str] = None,
        days_period: int = 30,
        current_user: any = Depends(get_current_user)
):
    # 1. Preluare inventar
    items = list(inventory_collection.find({"store_id": store_id}))
    grid_data = []

    # Praguri de timp pentru calcule
    now = datetime.now()
    start_date_period = now - timedelta(days=days_period)
    start_date_7d = now - timedelta(days=7)

    for item in items:
        if category and item.get("category") != category:
            continue

        # ID-ul produsului (String în colecția inventory conform screenshot-ului tău)
        prod_id_str = item.get("product_id")
        stock = item.get("stock_quantity") or item.get("quantity") or 0

        # --- MIN SAFETY ---
        # Luat direct din inventory_collection (unde este salvat ca reorder_level)
        min_safety = item.get("reorder_level", 0)

        # --- CONVERSIE PENTRU CĂUTARE ---
        try:
            p_id_obj = ObjectId(prod_id_str)
        except:
            p_id_obj = prod_id_str

        # --- DATE PRODUS (Nume/SKU/Preț) ---
        prod_doc = products_collection.find_one({"_id": p_id_obj})
        sku = prod_doc.get("sku", "N/A") if prod_doc else "N/A"
        name = prod_doc.get("name", "Unknown") if prod_doc else "Unknown"
        price = prod_doc.get("price", 0) if prod_doc else 0

        # --- CALCUL 7D VELOCITY ---
        sales_7d_list = list(sales_collection.find({
            "product": name,  # Folosim numele produsului găsit mai sus
            "store_id": store_id,
            "date": {"$gte": start_date_7d}  # Schimbat din sale_date în date
        }))
        velocity_7d = sum([s.get("quantity", 0) for s in sales_7d_list])

        # --- CALCUL DOC ---
        sales_period = list(sales_collection.find({
            "product": name,
            "store_id": store_id,
            "date": {"$gte": start_date_period}
        }))
        total_sold = sum([s.get("quantity", 0) for s in sales_period])

        avg_daily_sales = total_sold / days_period if days_period > 0 else 0
        doc_value = round(stock / avg_daily_sales, 1) if avg_daily_sales > 0 else (999 if stock > 0 else 0)

        # --- CONSTRUCȚIE OBIECT FINAL ---
        grid_data.append({
            "id": str(item["_id"]),
            "sku": sku,
            "name": name,
            "category": item.get("category", "N/A"),
            "current_stock": stock,
            "unit_price": price,
            "reorder_point": min_safety,  # Afișat ca Min Safety în UI
            "sales_7d": velocity_7d,  # 7D Velocity
            "doc": doc_value  # Doc
        })

    return serialize_mongo(grid_data)