from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
import pandas as pd
from bson import ObjectId
from datetime import datetime, timedelta
from database import db, inventory_collection, products_collection, sales_collection
from dal.inventory_repo import get_inventory_by_store
from dal.sales_repo import get_sales_by_product
from dal.products_repo import get_product_by_id
from utils.auth import get_current_user
from models import InventoryItem,Product

router = APIRouter()


def serialize_mongo(doc):
    if isinstance(doc, list): return [serialize_mongo(i) for i in doc]
    if isinstance(doc, dict):
        return {("id" if k == "_id" else k): (str(v) if isinstance(v, ObjectId) else serialize_mongo(v)) for k, v in
                doc.items()}
    return doc


@router.get("/categories/{store_id}")
async def get_unique_categories(store_id: str):
    try:
        # Extragem ID-urile produselor care se află în inventarul magazinului
        product_ids = inventory_collection.distinct("product_id", {"store_id": store_id})

        # Extragem categoriile unice din colecția de produse pentru acele ID-uri
        # Notă: Dacă stochezi categoria direct în inventory, e și mai simplu
        unique_categories = products_collection.distinct(
            "category",
            {"_id": {"$in": [ObjectId(pid) for pid in product_ids if ObjectId.is_valid(pid)]}}
        )

        return sorted([cat for cat in unique_categories if cat])  # Returnăm lista sortată
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/grid-data/{store_id}")
async def get_inventory_grid(
        store_id: str,
        category: Optional[str] = None,
        days_period: int = 30,
        current_user: any = Depends(get_current_user)
):
    items = list(inventory_collection.find({"store_id": store_id}))
    grid_data = []

    now = datetime.now()
    # Calculăm pragurile folosind sale_date
    start_date_period = now - timedelta(days=days_period)
    start_date_7d = now - timedelta(days=7)

    for item in items:
        pid = item.get("product_id")
        product = get_product_by_id(pid)

        if category and product and product.get("category") != category:
            continue

        stock = item.get("stock_quantity") or item.get("quantity") or 0
        min_safety = item.get("reorder_point", 0)

        sku = product.get("sku", "N/A") if product else "N/A"
        name = product.get("name", "Unknown") if product else "Unknown"
        price = product.get("price", 0) if product else 0

        # --- CORECTAT: 7D VELOCITY ---
        # Folosim "product_id" (linkul sigur) și "sale_date" (numele real din DB)
        sales_7d_list = list(sales_collection.find({
            "product_id": pid,
            "store_id": store_id,
            "sale_date": {"$gte": start_date_7d}
        }))
        velocity_7d = sum([s.get("quantity", 0) for s in sales_7d_list])

        # --- CORECTAT: CALCUL DOC ---
        # Folosim "sale_date" aici de asemenea
        sales_period = list(sales_collection.find({
            "product_id": pid,
            "store_id": store_id,
            "sale_date": {"$gte": start_date_period}
        }))
        total_sold = sum([s.get("quantity", 0) for s in sales_period])

        avg_daily_sales = total_sold / days_period if days_period > 0 else 0
        doc_value = round(stock / avg_daily_sales, 1) if avg_daily_sales > 0 else (999 if stock > 0 else 0)

        grid_data.append({
            "id": str(item["_id"]),
            "sku": sku,
            "name": name,
            "category": product.get("category", "N/A") if product else "N/A",
            "current_stock": stock,
            "unit_price": price,
            "reorder_point": min_safety,
            "sales_7d": velocity_7d,
            "doc": doc_value
        })

    return serialize_mongo(grid_data)