from fastapi import APIRouter, Query
from database import db
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId

router = APIRouter()  # Remove prefix from here

inventory_collection = db["inventory"]
products_collection = db["products"]
sales_collection = db["sales"]
purchase_orders_collection = db["purchase_orders"]

@router.get("/notifications")
async def get_notifications(store_id: Optional[str] = Query(None)):
    """Get notifications for a specific store"""
    notifications = []

    # Low stock alerts
    query = {"store_id": store_id} if store_id else {}
    low_stock_items = list(inventory_collection.find({
        **query,
        "$expr": {"$lte": ["$quantity", "$reorder_level"]}
    }).limit(10))

    for item in low_stock_items:
        product_name = "Unknown product"
        if item.get("product_id"):
            product = products_collection.find_one({"product_id": item["product_id"]})
            if product:
                product_name = product.get("name", "Unknown product")

        notifications.append({
            "id": str(ObjectId()),
            "type": "low_stock",
            "message": f"Low stock alert: {product_name}",
            "details": f"Only {item.get('quantity', 0)} units remaining",
            "timestamp": datetime.utcnow().isoformat(),
            "unread": True,
            "severity": "warning"
        })

    # Recent purchase orders
    recent_pos = list(purchase_orders_collection.find(query).sort("created_at", -1).limit(5))
    for po in recent_pos:
        created_at = po.get("created_at")
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at)
            except:
                created_at = datetime.utcnow()
        elif not isinstance(created_at, datetime):
            created_at = datetime.utcnow()

        # Only show POs from last 24 hours
        if datetime.utcnow() - created_at < timedelta(hours=24):
            status = po.get("status", "pending")
            total = po.get("total_cost", 0)

            notifications.append({
                "id": str(po.get("_id", ObjectId())),
                "type": "purchase_order",
                "message": f"Purchase order {status}",
                "details": f"Total: €{total:,.2f}",
                "timestamp": created_at.isoformat(),
                "unread": True,
                "severity": "info"
            })

    # High sales activity (items sold > 50 in last 24h)
    yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()
    high_sales = list(sales_collection.aggregate([
        {
            "$match": {
                **query,
                "date": {"$gte": yesterday}
            }
        },
        {
            "$group": {
                "_id": "$product_id",
                "total_quantity": {"$sum": "$quantity"}
            }
        },
        {
            "$match": {
                "total_quantity": {"$gte": 50}
            }
        }
    ]))

    for sale in high_sales:
        product_name = "Unknown product"
        product = products_collection.find_one({"product_id": sale["_id"]})
        if product:
            product_name = product.get("name", "Unknown product")

        notifications.append({
            "id": str(ObjectId()),
            "type": "high_sales",
            "message": f"High sales activity: {product_name}",
            "details": f"{sale['total_quantity']} units sold today",
            "timestamp": datetime.utcnow().isoformat(),
            "unread": True,
            "severity": "success"
        })

    # Sort by timestamp (most recent first)
    notifications.sort(key=lambda x: x["timestamp"], reverse=True)

    return notifications[:20]  # Limit to 20 most recent

@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read"""
    # In a real app, you'd store read status in DB
    return {"success": True, "notification_id": notification_id}

@router.post("/notifications/read-all")
async def mark_all_read(store_id: Optional[str] = Query(None)):
    """Mark all notifications as read for a store"""
    # In a real app, you'd update DB
    return {"success": True}
