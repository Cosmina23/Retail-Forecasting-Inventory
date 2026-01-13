from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
from bson.errors import InvalidId
from collections import defaultdict

# Modele și Auth
from models import Store, StoreCreate
from utils.auth import get_current_user

# Repository (DAL)
from dal.stores_repo import create_store, get_store_by_id, get_stores_by_user

# Infrastructură DB
from database import db, stores_collection

router = APIRouter(tags=["stores"])

# Colecții
sales_collection = db["sales"]
inventory_collection = db["inventory"]


# --- Utilități de Serializare ---

def serialize_mongo(doc):
    """
    Convertește recursiv toate instanțele de ObjectId în string-uri.
    Rezolvă eroarea PydanticSerializationError.
    """
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_mongo(item) for item in doc]
    if isinstance(doc, dict):
        # Mapăm _id la id pentru frontend și convertim restul de ObjectId
        new_doc = {}
        for k, v in doc.items():
            key = "id" if k == "_id" else k
            new_doc[key] = str(v) if isinstance(v, ObjectId) else serialize_mongo(v)
        return new_doc
    return doc


def get_uid(current_user):
    """Extrage ID-ul utilizatorului indiferent dacă current_user este dict sau string."""
    if isinstance(current_user, dict):
        return current_user.get("_id")
    return current_user


# --- Endpoints ---

@router.get("/")
async def list_stores(current_user: Optional[dict] = Depends(get_current_user)):
    """Listing public (pentru vizitatori) sau privat (pentru proprietari)."""
    # Cazul 1: Vizitator (fără login)
    if not current_user:
        stores = list(stores_collection.find({}, {"user_id": 0}))
        return serialize_mongo(stores)

    # Cazul 2: Utilizator autentificat
    uid = get_uid(current_user)
    stores = list(
        stores_collection.find({"user_id": ObjectId(uid) if isinstance(uid, str) and ObjectId.is_valid(uid) else uid}))
    return serialize_mongo(stores)


@router.get("/me", response_model=List[dict])
async def get_my_stores(current_user: any = Depends(get_current_user)):
    """Obține magazinele utilizatorului curent folosind conversie sigură de ID."""
    uid = get_uid(current_user)

    # Încercăm ambele formate pentru user_id (ObjectId și String) pentru compatibilitate
    query_id = ObjectId(uid) if isinstance(uid, str) and ObjectId.is_valid(uid) else uid
    stores = list(stores_collection.find({"$or": [{"user_id": query_id}, {"user_id": str(uid)}]}))

    return serialize_mongo(stores)


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_new_store(store: StoreCreate, current_user: any = Depends(get_current_user)):
    try:
        uid = get_uid(current_user)
        # Transmitem toate câmpurile obligatorii
        created = create_store(
            name=store.name,
            user_id=uid,
            market=store.market,
            address=store.address,
        )
        return serialize_mongo(created)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Incomplete data: {str(e)}")


@router.get("/{store_id}", response_model=dict)
async def get_store(store_id: str):
    """Obține detalii despre un magazin specific."""
    try:
        if not ObjectId.is_valid(store_id):
            # Fallback pentru store_id-uri custom (non-ObjectId)
            store = stores_collection.find_one({"store_id": store_id})
        else:
            store = stores_collection.find_one({"_id": ObjectId(store_id)})

        if not store:
            raise HTTPException(status_code=404, detail="Store not found")

        return serialize_mongo(store)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/{store_id}/metrics")
async def get_store_metrics(store_id: str, offset: int = 0, current_user: dict = Depends(get_current_user)):
    try:
        store = stores_collection.find_one({"_id": ObjectId(store_id)})
        uid = get_uid(current_user)
        if str(store.get("user_id")) != str(uid): raise HTTPException(status_code=403)

        now = datetime.utcnow()
        # Calcul Max Offset
        oldest_doc = sales_collection.find_one({"store_id": store_id}, sort=[("date", 1)])
        max_offset = int((now - oldest_doc["date"]).total_seconds() // (7 * 24 * 3600)) if oldest_doc else 0

        # Intervale timp
        view_end = now - timedelta(days=7 * offset)
        view_start = view_end - timedelta(days=7)
        comp_start = view_start - timedelta(days=7)

        # Sales queries
        curr_sales = list(sales_collection.find({"store_id": store_id, "date": {"$gte": view_start, "$lt": view_end}}))
        past_sales = list(
            sales_collection.find({"store_id": store_id, "date": {"$gte": comp_start, "$lt": view_start}}))

        # Metrics calculation
        curr_rev = sum(s.get("quantity", 0) * s.get("price", 0) for s in curr_sales)
        past_rev = sum(s.get("quantity", 0) * s.get("price", 0) for s in past_sales)
        rev_chg = round(((curr_rev - past_rev) / past_rev * 100), 1) if past_rev > 0 else 0

        # Categoriile cele mai vandute (Stil Screen Time)
        cat_map = defaultdict(float)
        for s in curr_sales:
            cat = s.get("category", "Other")
            cat_map[cat] += s.get("quantity", 0) * s.get("price", 0)

        top_cats = sorted(
            [{"name": k, "amount": round(v, 2), "percentage": round(v / curr_rev * 100, 1) if curr_rev > 0 else 0}
             for k, v in cat_map.items()], key=lambda x: x["amount"], reverse=True)

        # Inventory counts
        inv = list(inventory_collection.find({"store_id": store_id}))
        total_stock = sum(i.get("stock_quantity") or i.get("quantity") or 0 for i in inv)
        critical = sum(1 for i in inv if (i.get("stock_quantity") or 0) <= (i.get("reorder_level") or 10))

        return {
            "weekly_revenue": round(curr_rev, 2),
            "revenue_change": rev_chg,
            "orders": len(curr_sales),
            "orders_change": round(((len(curr_sales) - len(past_sales)) / len(past_sales) * 100), 1) if len(
                past_sales) > 0 else 0,
            "stock_level": total_stock,
            "critical_items": critical,
            "max_offset": max_offset,
            "top_categories": top_cats[:5]  # Primele 5 cele mai vandute
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{store_id}/sales-forecast")
async def get_store_sales_forecast(store_id: str, offset: int = 0, current_user: dict = Depends(get_current_user)):
    """Date istorice vs Forecast raportate la offset-ul de timp selectat."""
    try:
        if not ObjectId.is_valid(store_id):
            raise HTTPException(status_code=400, detail="Invalid ID")

        store = stores_collection.find_one({"_id": ObjectId(store_id)})
        uid = get_uid(current_user)

        if not store or str(store.get("user_id")) != str(uid):
            raise HTTPException(status_code=403, detail="Unauthorized")

        # Calculăm intervalul bazat pe offset
        now = datetime.utcnow()
        view_end = now - timedelta(days=7 * offset)
        view_start = view_end - timedelta(days=7)

        # Preluare date din baza de date
        sales_data = list(sales_collection.find({
            "store_id": store_id,
            "date": {"$gte": view_start, "$lt": view_end}
        }))
        forecast_data = list(db["forecasts"].find({
            "store_id": store_id,
            "forecast_date": {"$gte": view_start, "$lt": view_end}
        }))

        sales_map = defaultdict(float)
        for s in sales_data:
            dt = s.get("date")
            d_obj = dt if isinstance(dt, datetime) else datetime.fromisoformat(str(dt).replace('Z', '+00:00'))
            sales_map[d_obj.strftime("%b %d")] += s.get("quantity", 0) * s.get("price", 0)

        forecast_map = defaultdict(float)
        for f in forecast_data:
            dt = f.get("forecast_date")
            d_obj = dt if isinstance(dt, datetime) else datetime.fromisoformat(str(dt).replace('Z', '+00:00'))
            val = f.get("forecast_value") or (f.get("forecast_demand", 0) * f.get("price", 0))
            forecast_map[d_obj.strftime("%b %d")] += val

        result = []
        # Generăm cele 7 zile ale ferestrei selectate
        for i in range(7, 0, -1):
            # i + (offset * 7) ne dă data corectă în trecut
            day = now - timedelta(days=i + (offset * 7))
            key = day.strftime("%b %d")
            result.append({
                "date": key,
                "actual": round(sales_map.get(key, 0), 2),
                "forecast": round(forecast_map.get(key, 0), 2)
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{store_id}")
async def delete_store_endpoint(store_id: str, current_user: dict = Depends(get_current_user)):
    """Șterge un magazin dacă utilizatorul este proprietar."""
    try:
        uid = get_uid(current_user)
        res = stores_collection.delete_one({"_id": ObjectId(store_id), "user_id": uid})
        if res.deleted_count == 0:
            # Încercăm și cu user_id ca string pentru siguranță
            res = stores_collection.delete_one({"_id": ObjectId(store_id), "user_id": str(uid)})

        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Store not found or unauthorized")
        return {"message": "Store deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))