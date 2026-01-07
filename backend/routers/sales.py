from fastapi import APIRouter, HTTPException, Query
from database import db
from bson import ObjectId
from typing import List, Optional
from datetime import datetime, timedelta
from collections import defaultdict

router = APIRouter(prefix="/sales", tags=["sales"])

sales_collection = db["sales"]
products_collection = db["products"]
inventory_collection = db["inventory"]

@router.get("/")
async def get_sales(store_id: Optional[str] = Query(None)):
    """Get sales for a specific store"""
    query = {}
    if store_id:
        query["store_id"] = store_id

    sales = []
    for sale in sales_collection.find(query).sort("date", -1).limit(100):
        sale["_id"] = str(sale["_id"])
        sales.append(sale)

    return sales

@router.get("/monthly")
async def get_monthly_sales(store_id: Optional[str] = Query(None)):
    """Get monthly revenue trend for a specific store"""
    query = {"store_id": store_id} if store_id else {}

    # Get sales from the last 6 months
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    query["date"] = {"$gte": six_months_ago.isoformat()}

    sales = list(sales_collection.find(query))

    if sales:
        monthly_revenue = defaultdict(float)

        for sale in sales:
            try:
                sale_date = datetime.fromisoformat(sale.get("date", ""))
                month_key = sale_date.strftime("%b")

                quantity = sale.get("quantity", 0)
                price = sale.get("price", 0)

                if not price and sale.get("product_id"):
                    product = products_collection.find_one({"product_id": sale["product_id"]})
                    if product:
                        price = product.get("price", 0)

                monthly_revenue[month_key] += quantity * price
            except:
                continue

        # Get last 6 months in order
        months = []
        current_date = datetime.utcnow()
        for i in range(5, -1, -1):
            month_date = current_date - timedelta(days=30 * i)
            month_name = month_date.strftime("%b")
            months.append({
                "month": month_name,
                "revenue": int(monthly_revenue.get(month_name, 0))
            })

        # Only return if we have some data
        if any(m["revenue"] > 0 for m in months):
            return months

    # Return empty array - NO MOCK DATA
    return []

@router.post("/")
async def create_sale(sale: dict):
    """Create a new sale record"""
    if "date" not in sale:
        sale["date"] = datetime.utcnow().isoformat()

    result = sales_collection.insert_one(sale)
    sale["_id"] = str(result.inserted_id)
    return sale
