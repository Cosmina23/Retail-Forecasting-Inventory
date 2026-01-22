from fastapi import APIRouter, HTTPException, Query, Depends
from database import db
from bson import ObjectId
from bson.errors import InvalidId
from typing import List, Optional
from datetime import datetime, timedelta
from utils.auth import get_current_user
from dal.stores_repo import get_store_by_id

router = APIRouter()  # Remove prefix from here

activity_collection = db["activity"]
sales_collection = db["sales"]
inventory_collection = db["inventory"]
products_collection = db["products"]
stores_collection = db["stores"]

def verify_store_ownership(store_id: str, current_user: Optional[dict]) -> tuple[bool, Optional[str]]:
    """Verify that the store belongs to the current user
    Returns: (is_owner, actual_store_id_for_query)
    """
    if not current_user:
        return False, None

    try:
        # Try to find store by _id (ObjectId)
       # object_id = ObjectId(store_id)
        store = get_store_by_id(store_id)
    except (InvalidId, Exception):
        # If not valid ObjectId, try store_id field
        store =get_store_by_id(store_id)

    if not store:
        return False, None

    # Check ownership
    is_owner = store.get("user_id") == current_user["_id"]

    # Return the actual _id as string for querying
    actual_store_id = str(store["_id"])

    return is_owner, actual_store_id

@router.get("/activity")
async def get_activity(
    store_id: Optional[str] = Query(None),
    current_user: Optional[dict] = Depends(get_current_user)
):
    """Get recent activity for a specific store (only if user owns the store)"""
    if not store_id:
        return []

    # Verify store ownership and get actual store_id for querying
    is_owner, actual_store_id = verify_store_ownership(store_id, current_user)
    if not is_owner or not actual_store_id:
        return []

    query = {"store_id": actual_store_id}

    # Try to get real activity from DB
    activities = list(activity_collection.find(query).sort("date", -1).limit(100))

    if activities:
        activity_data = []
        for activity in activities:
            # Format date properly
            date_value = activity.get("date", datetime.utcnow())
            if isinstance(date_value, datetime):
                date_str = date_value.strftime("%b %d, %Y")
            elif isinstance(date_value, str):
                try:
                    date_obj = datetime.fromisoformat(date_value)
                    date_str = date_obj.strftime("%b %d, %Y")
                except:
                    date_str = date_value
            else:
                date_str = datetime.utcnow().strftime("%b %d, %Y")

            activity_data.append({
                "date": date_str,
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

    # Return empty array
    return []

@router.post("/")
async def create_activity(activity: dict):
    """Create a new activity record"""
    if "date" not in activity:
        activity["date"] = datetime.utcnow().isoformat()

    result = activity_collection.insert_one(activity)
    activity["_id"] = str(result.inserted_id)
    return activity
