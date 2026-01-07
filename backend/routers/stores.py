from fastapi import APIRouter, HTTPException, Depends
from database import stores_collection, db
from models import Store
from bson import ObjectId
from bson.errors import InvalidId
from .auth import get_current_user
from typing import Optional
from datetime import datetime, timedelta

router = APIRouter(prefix="/stores", tags=["stores"])

sales_collection = db["sales"]
inventory_collection = db["inventory"]


@router.get("/")
async def get_user_stores(current_user: Optional[dict] = Depends(get_current_user)):
    # 1. Cazul pentru vizitatori (fără login)
    if not current_user:
        stores = []
        for store in stores_collection.find():
            store["id"] = str(store["_id"])
            store.pop("_id", None)
            store.pop("user_id", None)  # Important: scoatem user_id dacă e ObjectId
            stores.append(store)
        return stores

    # 2. Cazul pentru utilizatori autentificați
    stores = []
    # Căutăm magazinele care aparțin utilizatorului curent
    for store in stores_collection.find({"user_id": current_user["_id"]}):
        store["id"] = str(store["_id"])
        store.pop("_id", None)

        # EROAREA ERA AICI: Trebuie să convertim sau să ștergem și user_id
        if "user_id" in store:
            store["user_id"] = str(store["user_id"])

        stores.append(store)
    return stores


@router.post("/")
async def create_store(store: Store, current_user: Optional[dict] = Depends(get_current_user)):
    store_data = store.dict()

    if current_user:
        store_data["user_id"] = current_user["_id"]

    store_data["status"] = store.status
    store_data["revenue"] = store.revenue

    result = stores_collection.insert_one(store_data)

    # Preluăm magazinul proaspăt creat
    created_store = stores_collection.find_one({"_id": result.inserted_id})

    # Curățăm obiectul înainte de return
    created_store["id"] = str(created_store["_id"])
    created_store.pop("_id", None)

    if "user_id" in created_store:
        created_store["user_id"] = str(created_store["user_id"])

    return created_store


@router.get("/{store_id}/metrics")
async def get_store_metrics(store_id: str):
    """Get metrics for a specific store"""
    try:
        # Validăm că store_id este un ObjectId valid
        try:
            object_id = ObjectId(store_id)
        except (InvalidId, Exception):
            raise HTTPException(status_code=404, detail=f"Invalid store ID format: {store_id}")

        # Verificăm că store-ul există
        store = stores_collection.find_one({"_id": object_id})
        if not store:
            raise HTTPException(status_code=404, detail=f"Store not found with ID: {store_id}")

        # Calculăm metricile pentru ultimele 24h și comparăm cu perioada anterioară
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)

        # Sales de azi
        today_sales = list(sales_collection.find({
            "store_id": store_id,
            "date": {"$gte": today_start.isoformat()}
        }))

        # Sales de ieri
        yesterday_sales = list(sales_collection.find({
            "store_id": store_id,
            "date": {"$gte": yesterday_start.isoformat(), "$lt": today_start.isoformat()}
        }))

        # Calculăm revenue
        today_revenue = sum(sale.get("quantity", 0) * sale.get("price", 0) for sale in today_sales)
        yesterday_revenue = sum(sale.get("quantity", 0) * sale.get("price", 0) for sale in yesterday_sales)

        revenue_change = 0
        if yesterday_revenue > 0:
            revenue_change = round(((today_revenue - yesterday_revenue) / yesterday_revenue) * 100, 1)

        # Orders
        today_orders = len(today_sales)
        yesterday_orders = len(yesterday_sales)

        orders_change = 0
        if yesterday_orders > 0:
            orders_change = round(((today_orders - yesterday_orders) / yesterday_orders) * 100, 1)

        # Stock level
        inventory_items = list(inventory_collection.find({"store_id": store_id}))
        stock_level = sum(item.get("quantity", 0) for item in inventory_items)

        # Critical items (below reorder level)
        critical_items = sum(1 for item in inventory_items
                            if item.get("quantity", 0) <= item.get("reorder_level", 0))

        return {
            "daily_revenue": today_revenue,
            "revenue_change": revenue_change,
            "orders": today_orders,
            "orders_change": orders_change,
            "stock_level": stock_level,
            "stock_change": 0,  # Poate fi implementat dacă avem istoric
            "critical_items": critical_items,
            "critical_items_change": 0
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating metrics: {str(e)}")


@router.get("/{store_id}")
async def get_store(store_id: str):
    """Get a specific store by ID"""
    try:
        # Validăm că store_id este un ObjectId valid
        try:
            object_id = ObjectId(store_id)
        except (InvalidId, Exception):
            raise HTTPException(status_code=404, detail=f"Invalid store ID format: {store_id}")

        store = stores_collection.find_one({"_id": object_id})
        if not store:
            raise HTTPException(status_code=404, detail=f"Store not found with ID: {store_id}")

        store["id"] = str(store["_id"])
        store.pop("_id", None)

        if "user_id" in store:
            store["user_id"] = str(store["user_id"])

        return store
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Store not found: {str(e)}")


@router.delete("/{store_id}")
async def delete_store(store_id: str, current_user: Optional[dict] = Depends(get_current_user)):
    query = {"_id": ObjectId(store_id)}

    # Dacă este autentificat, verifică că store-ul aparține utilizatorului
    if current_user:
        query["user_id"] = current_user["_id"]

    result = stores_collection.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Store not found")
    return {"message": "Store deleted"}
