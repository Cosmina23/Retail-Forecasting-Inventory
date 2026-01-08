from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional
from utils.auth import get_current_user
from dal.sales_repo import (
    list_sales,
    get_sales_summary,
    get_sales_by_store,
    get_sales_by_product,
)
from database import db
from datetime import datetime, timedelta
from collections import defaultdict

router = APIRouter(prefix="/sales", tags=["sales"])

sales_collection = db["sales"]
products_collection = db.get("products")
inventory_collection = db.get("inventory")


@router.get("/", response_model=List[dict])
async def get_sales(skip: int = 0, limit: int = 100, days: Optional[int] = None, current_user: str = Depends(get_current_user)):
    """Get all sales, optionally filter by days."""
    return list_sales(skip=skip, limit=limit, days=days)


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


@router.post("/")
async def create_sale(sale: dict):
    """Create a new sale record (legacy direct DB endpoint)."""
    if "date" not in sale:
        sale["date"] = datetime.utcnow().isoformat()
    result = sales_collection.insert_one(sale)
    sale["_id"] = str(result.inserted_id)
    return sale

