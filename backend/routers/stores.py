from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from models import Store, StoreCreate
from utils.auth import get_current_user
from dal.stores_repo import create_store, get_store_by_id, get_stores_by_user
from database import db, stores_collection
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timedelta

router = APIRouter(prefix="/stores", tags=["stores"])

# DB collections used for metrics and some ad-hoc endpoints
sales_collection = db["sales"]
inventory_collection = db["inventory"]


@router.get("/")
async def list_stores(current_user: Optional[dict] = Depends(get_current_user)):
    """Public listing: returns stores visible to visitors and to authenticated users.
    - Visitors: return public view of all stores
    - Authenticated: return stores belonging to the user
    """
    # Visitor (no login)
    if not current_user:
        stores = []
        for s in stores_collection.find():
            s["id"] = str(s["_id"])
            s.pop("_id", None)
            s.pop("user_id", None)
            stores.append(s)
        return stores

    # Authenticated user: return user's stores
    stores = []
    for s in stores_collection.find({"user_id": current_user["_id"]}):
        s["id"] = str(s["_id"])
        s.pop("_id", None)
        if "user_id" in s:
            s["user_id"] = str(s["user_id"])
        stores.append(s)
    return stores


@router.get("/me", response_model=List[dict])
async def get_my_stores(current_user: str = Depends(get_current_user)):
    """Get all stores for the current user (DAL-backed)."""
    return get_stores_by_user(current_user)


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_store_endpoint(store: StoreCreate, current_user: str = Depends(get_current_user)):
    """Create a new store (DAL-backed)."""
    try:
        created = create_store(
            name=store.name,
            user_id=current_user,
            market=store.market,
            address=store.address,
        )
        return created
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{store_id}", response_model=dict)
async def get_store(store_id: str, current_user: Optional[str] = Depends(get_current_user)):
    """Get a store by ID. Tries DAL first, falls back to direct DB lookup for compatibility."""
    store = get_store_by_id(store_id)
    if store:
        return store

    # Fallback: direct DB lookup (handles older storage shapes)
    try:
        object_id = ObjectId(store_id)
    except (InvalidId, Exception):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Invalid store ID format: {store_id}")

    s = stores_collection.find_one({"_id": object_id})
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    s["id"] = str(s["_id"])
    s.pop("_id", None)
    if "user_id" in s:
        s["user_id"] = str(s["user_id"])
    return s


@router.get("/{store_id}/metrics")
async def get_store_metrics(store_id: str):
    """Get simple metrics (daily revenue, orders, stock level, critical items)."""
    try:
        # validate id
        try:
            object_id = ObjectId(store_id)
        except (InvalidId, Exception):
            raise HTTPException(status_code=404, detail=f"Invalid store ID format: {store_id}")

        store = stores_collection.find_one({"_id": object_id})
        if not store:
            raise HTTPException(status_code=404, detail=f"Store not found with ID: {store_id}")

        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)

        today_sales = list(sales_collection.find({
            "store_id": store_id,
            "date": {"$gte": today_start.isoformat()}
        }))

        yesterday_sales = list(sales_collection.find({
            "store_id": store_id,
            "date": {"$gte": yesterday_start.isoformat(), "$lt": today_start.isoformat()}
        }))

        today_revenue = sum(s.get("quantity", 0) * s.get("price", 0) for s in today_sales)
        yesterday_revenue = sum(s.get("quantity", 0) * s.get("price", 0) for s in yesterday_sales)

        revenue_change = 0
        if yesterday_revenue > 0:
            revenue_change = round(((today_revenue - yesterday_revenue) / yesterday_revenue) * 100, 1)

        today_orders = len(today_sales)
        yesterday_orders = len(yesterday_sales)
        orders_change = 0
        if yesterday_orders > 0:
            orders_change = round(((today_orders - yesterday_orders) / yesterday_orders) * 100, 1)

        inventory_items = list(inventory_collection.find({"store_id": store_id}))
        stock_level = sum(item.get("quantity", 0) for item in inventory_items)
        critical_items = sum(1 for item in inventory_items if item.get("quantity", 0) <= item.get("reorder_level", 0))

        return {
            "daily_revenue": today_revenue,
            "revenue_change": revenue_change,
            "orders": today_orders,
            "orders_change": orders_change,
            "stock_level": stock_level,
            "stock_change": 0,
            "critical_items": critical_items,
            "critical_items_change": 0,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating metrics: {str(e)}")


@router.delete("/{store_id}")
async def delete_store(store_id: str, current_user: Optional[dict] = Depends(get_current_user)):
    query = {"_id": ObjectId(store_id)}
    if current_user:
        query["user_id"] = current_user["_id"]
    result = stores_collection.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Store not found")
    return {"message": "Store deleted"}
