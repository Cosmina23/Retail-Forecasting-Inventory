from fastapi import APIRouter, HTTPException, Query
from database import db
from bson import ObjectId
from typing import List, Optional
from datetime import datetime, timedelta

router = APIRouter(prefix="/activity", tags=["activity"])

activity_collection = db["activity"]
sales_collection = db["sales"]
inventory_collection = db["inventory"]
products_collection = db["products"]

@router.get("/")
async def get_activity(store_id: Optional[str] = Query(None)):
    """Get recent activity for a specific store"""
    query = {"store_id": store_id} if store_id else {}

    # Try to get real activity from DB
    activities = list(activity_collection.find(query).sort("date", -1).limit(10))

    if activities:
        activity_data = []
        for activity in activities:
            activity_data.append({
                "date": activity.get("date", datetime.utcnow().strftime("%b %d, %Y")),
                "type": activity.get("type", "sale"),
                "description": activity.get("description", "Activity"),
                "value": activity.get("value", "€0"),
                "positive": activity.get("positive", True)
            })
        return activity_data

    # Generate activity from recent sales and inventory changes
    recent_activity = []

    # Get recent sales
    recent_sales = list(sales_collection.find(query).sort("date", -1).limit(5))
    for sale in recent_sales:
        try:
            sale_date = datetime.fromisoformat(sale.get("date", ""))
            date_str = sale_date.strftime("%b %d, %Y")
        except:
            date_str = datetime.utcnow().strftime("%b %d, %Y")

        quantity = sale.get("quantity", 0)
        price = sale.get("price", 0)

        # Get product info if available
        product_name = "items"
        if sale.get("product_id"):
            product = products_collection.find_one({"product_id": sale["product_id"]})
            if product:
                product_name = product.get("name", "items")
                if not price:
                    price = product.get("price", 0)

        revenue = quantity * price

        recent_activity.append({
            "date": date_str,
            "type": "sale",
            "description": f"{quantity} {product_name} sold",
            "value": f"€{revenue:,.2f}",
            "positive": True
        })

    # Get low stock items
    low_stock = list(inventory_collection.find({
        **query,
        "$expr": {"$lte": ["$quantity", "$reorder_level"]}
    }).limit(3))

    for item in low_stock:
        product_name = "Unknown product"
        if item.get("product_id"):
            product = products_collection.find_one({"product_id": item["product_id"]})
            if product:
                product_name = product.get("name", "Unknown product")

        recent_activity.append({
            "date": datetime.utcnow().strftime("%b %d, %Y"),
            "type": "alert",
            "description": f"Low stock: {product_name}",
            "value": f"{item.get('quantity', 0)} units",
            "positive": False
        })

    # Sort by date (most recent first)
    recent_activity.sort(key=lambda x: x["date"], reverse=True)

    if recent_activity:
        return recent_activity[:6]

    # Return empty array - NO MOCK DATA
    return []

@router.post("/")
async def create_activity(activity: dict):
    """Create a new activity record"""
    if "date" not in activity:
        activity["date"] = datetime.utcnow().isoformat()

    result = activity_collection.insert_one(activity)
    activity["_id"] = str(result.inserted_id)
    return activity
