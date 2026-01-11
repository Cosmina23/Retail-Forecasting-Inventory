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
            store.pop("user_id", None)
            stores.append(store)
        return stores

    # 2. Cazul pentru utilizatori autentificați
    stores = []
    for store in stores_collection.find({"user_id": current_user["_id"]}):
        store["id"] = str(store["_id"])
        store.pop("_id", None)

        if "user_id" in store:
            store["user_id"] = str(store["user_id"])

        stores.append(store)
    return stores


@router.get("")
async def get_user_stores_no_slash(current_user: Optional[dict] = Depends(get_current_user)):
    """Alias for GET / without trailing slash"""
    return await get_user_stores(current_user)


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


@router.post("")
async def create_store_no_slash(store: Store, current_user: Optional[dict] = Depends(get_current_user)):
    """Alias for POST / without trailing slash"""
    return await create_store(store, current_user)


@router.get("/{store_id}/metrics")
async def get_store_metrics(store_id: str, current_user: Optional[dict] = Depends(get_current_user)):
    """Get metrics for a specific store (only if user owns the store)"""
    try:
        # Find store by _id (ObjectId)
        try:
            object_id = ObjectId(store_id)
        except (InvalidId, Exception):
            raise HTTPException(status_code=404, detail=f"Invalid store ID format: {store_id}")

        store = stores_collection.find_one({"_id": object_id})

        if not store:
            raise HTTPException(status_code=404, detail=f"Store not found with ID: {store_id}")

        # Verify store ownership
        if not current_user:
            raise HTTPException(status_code=403, detail="Access denied: Authentication required")

        if store.get("user_id") != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Access denied: You don't own this store")

        # Use _id string for querying sales/inventory
        query_store_id = str(store["_id"])

        # Calculăm metricile pentru ultimele 24h și comparăm cu perioada anterioară
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)

        # Sales de azi
        today_sales = list(sales_collection.find({
            "store_id": query_store_id,
            "date": {"$gte": today_start}
        }))

        # Sales de ieri
        yesterday_sales = list(sales_collection.find({
            "store_id": query_store_id,
            "date": {"$gte": yesterday_start, "$lt": today_start}
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
        inventory_items = list(inventory_collection.find({"store_id": query_store_id}))
        stock_level = sum(item.get("stock_quantity", 0) for item in inventory_items)

        # Critical items (below reorder level)
        critical_items = 0
        for item in inventory_items:
            current_qty = item.get("stock_quantity", 0)
            default_reorder = int(current_qty * 0.2) if current_qty > 0 else 10
            reorder_level = item.get("reorder_level", default_reorder)
            if current_qty <= reorder_level:
                critical_items += 1

        result = {
            "daily_revenue": today_revenue,
            "revenue_change": revenue_change,
            "orders": today_orders,
            "orders_change": orders_change,
            "stock_level": stock_level,
            "stock_change": 0,
            "critical_items": critical_items,
            "critical_items_change": 0
        }

        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error calculating metrics: {str(e)}")


@router.get("/{store_id}")
async def get_store(store_id: str):
    """Get a specific store by MongoDB _id"""
    try:
        # Parse as ObjectId
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


@router.get("/{store_id}/sales-forecast")
async def get_store_sales_forecast(store_id: str, current_user: Optional[dict] = Depends(get_current_user)):
    """Get combined sales history and forecast data for dashboard chart"""
    try:
        # Find store by _id
        try:
            object_id = ObjectId(store_id)
        except (InvalidId, Exception):
            raise HTTPException(status_code=404, detail=f"Invalid store ID format: {store_id}")

        store = stores_collection.find_one({"_id": object_id})

        if not store:
            raise HTTPException(status_code=404, detail=f"Store not found with ID: {store_id}")

        # Verify store ownership
        if current_user and store.get("user_id") != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Access denied: You don't own this store")

        query_store_id = str(store["_id"])

        # Get sales from last 7 days
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        sales_data = list(sales_collection.find({
            "store_id": query_store_id,
            "date": {"$gte": seven_days_ago}
        }).sort("date", 1))

        # Get forecasts (if any)
        forecasts_collection = db["forecasts"]
        forecast_data = list(forecasts_collection.find({
            "store_id": query_store_id,
            "forecast_date": {"$gte": seven_days_ago}
        }).sort("forecast_date", 1))

        # Group sales by date
        from collections import defaultdict
        sales_by_date = defaultdict(float)

        for sale in sales_data:
            try:
                raw_date = sale.get("date")

                # Verificăm dacă este deja obiect datetime sau dacă trebuie convertit din string
                if isinstance(raw_date, datetime):
                    sale_date = raw_date
                elif isinstance(raw_date, str):
                    sale_date = datetime.fromisoformat(raw_date.replace('Z', '+00:00'))
                else:
                    continue  # Dacă lipsește sau e alt format, sărim peste

                date_key = sale_date.strftime("%b %d")
                quantity = sale.get("quantity", 0)
                price = sale.get("price", 0)
                sales_by_date[date_key] += (quantity * price)
            except Exception as e:
                print(f"Eroare procesare vânzare: {e}")  # Nu folosi 'pass' simplu în debug

        # Group forecasts by date
        forecasts_by_date = defaultdict(float)

        for forecast in forecast_data:
            try:
                raw_date = forecast.get("forecast_date")
                if isinstance(raw_date, datetime):
                    f_date = raw_date
                else:
                    f_date = datetime.fromisoformat(str(raw_date).replace('Z', '+00:00'))

                date_key = f_date.strftime("%b %d")
                # Asigură-te că numele câmpurilor (forecast_demand, price) sunt identice cu cele din DB
                val = forecast.get("forecast_demand", 0) * forecast.get("price", 0)
                forecasts_by_date[date_key] += val
            except Exception as e:
                print(f"Forecast error: {e}")

        # Combine into chart format
        result = []

        # Last 7 days
        for i in range(7, 0, -1):
            date = datetime.utcnow() - timedelta(days=i)
            date_key = date.strftime("%b %d")

            result.append({
                "date": date_key,
                "actual": round(sales_by_date.get(date_key, 0), 2),
                "forecast": round(forecasts_by_date.get(date_key, 0), 2)
            })

        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching sales forecast data: {str(e)}")


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
