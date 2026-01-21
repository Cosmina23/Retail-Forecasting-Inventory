from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
from bson.errors import InvalidId
from collections import defaultdict
import traceback
from dateutil import parser

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


def get_anchor_date(store_id):
    latest_sale = sales_collection.find_one({"store_id": store_id}, sort=[("sale_date", -1)])
    latest_forecast = db["forecasts"].find_one({"store_id": store_id}, sort=[("forecast_date", -1)])

    dates = []
    if latest_sale:
        dt = latest_sale.get("sale_date") or latest_sale.get("date")
        dates.append(dt if isinstance(dt, datetime) else parser.parse(str(dt)))
    if latest_forecast:
        dt = latest_forecast.get("forecast_date")
        dates.append(dt if isinstance(dt, datetime) else parser.parse(str(dt)))
    return max(dates) if dates else datetime.utcnow()

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
    """Obține magazinele utilizatorului cu calculul venitului săptămânal inclus."""
    uid = get_uid(current_user)
    query_id = ObjectId(uid) if isinstance(uid, str) and ObjectId.is_valid(uid) else uid

    # 1. Obținem magazinele
    stores = list(stores_collection.find({"$or": [{"user_id": query_id}, {"user_id": str(uid)}]}))

    # 2. Calculăm data de început (acum 7 zile)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)

    enriched_stores = []
    for store in stores:
        store_id = str(store["_id"])

        # Calculăm suma vânzărilor pentru acest magazin în ultimele 7 zile
        pipeline = [
            {
                "$match": {
                    "store_id": store_id,
                    "sale_date": {"$gte": seven_days_ago}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "weekly_revenue": {"$sum": "$total_amount"}
                }
            }
        ]

        result = list(sales_collection.aggregate(pipeline))
        revenue = result[0]["weekly_revenue"] if result else 0
        store["revenue"] = round(revenue, 2)
        enriched_stores.append(store)

    return serialize_mongo(enriched_stores)


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


@router.get("/{store_id}/critical-items-list")
async def get_critical_items_details(store_id: str, current_user: dict = Depends(get_current_user)):
    try:
        pipeline = [
            {
                "$match": {
                    "store_id": store_id,
                    "$expr": {"$lte": ["$quantity", "$reorder_point"]}
                }
            },
            {
                "$lookup": {
                    "from": "products",
                    "let": {"pid": "$product_id"},
                    "pipeline": [
                        {"$match": {"$expr": {"$eq": [{"$toString": "$_id"}, "$$pid"]}}}
                    ],
                    "as": "product_info"
                }
            },
            {"$unwind": "$product_info"},
            {
                "$project": {
                    "_id": 1,
                    "product_id": 1,
                    "quantity": 1,
                    "reorder_point": 1,
                    "product_name": "$product_info.name",
                    "category": "$product_info.category",
                    "unit_price": "$product_info.price"
                }
            }
        ]

        results = list(inventory_collection.aggregate(pipeline))
        return serialize_mongo(results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        latest_sale = sales_collection.find_one({"store_id": store_id}, sort=[("sale_date", -1)])
        if not latest_sale:
            return {"weekly_revenue": 0, "orders": 0, "stock_level": 0, "critical_items": 0, "max_offset": 0,
                    "top_categories": [], "inventory_data": []}

        anchor_date = latest_sale["sale_date"]
        view_end = (anchor_date + timedelta(days=1)) - timedelta(days=7 * offset)
        view_start = view_end - timedelta(days=7)

        # 2. Pipeline Vânzări (Top Categories)
        sales_pipeline = [
            {"$match": {"store_id": store_id, "sale_date": {"$gte": view_start, "$lt": view_end}}},
            {
                "$lookup": {
                    "from": "products",
                    "let": {"pid": "$product_id"},
                    "pipeline": [{"$match": {"$expr": {"$eq": [{"$toString": "$_id"}, "$$pid"]}}}],
                    "as": "product_info"
                }
            },
            {"$unwind": "$product_info"},
            {"$group": {"_id": "$product_info.category", "amount": {"$sum": "$total_amount"}}}
        ]
        category_data = list(sales_collection.aggregate(sales_pipeline))
        total_revenue = sum(item["amount"] for item in category_data)

        # 3. Pipeline Inventar (Fără Group inițial pentru a păstra detaliile produselor)
        # Avem nevoie de detalii pentru Critical Items și de categorii pentru Pie Chart
        inv_full_pipeline = [
            {"$match": {"store_id": store_id}},
            {
                "$lookup": {
                    "from": "products",
                    "let": {"pid": "$product_id"},
                    "pipeline": [{"$match": {"$expr": {"$eq": [{"$toString": "$_id"}, "$$pid"]}}}],
                    "as": "product_info"
                }
            },
            {"$unwind": "$product_info"}
        ]

        # Luăm toate documentele de inventar "îmbogățite" cu info despre produs
        full_inventory = list(db["inventory"].aggregate(inv_full_pipeline))

        # Calculăm cifrele brute
        total_stock = sum(d.get("quantity", 0) for d in full_inventory)
        critical_items = sum(1 for d in full_inventory if d.get("quantity", 0) <= d.get("reorder_point", 0))

        # Agregăm manual categoriile pentru Pie Chart (Inventory Split)
        cat_counts = {}
        for d in full_inventory:
            cat = d["product_info"].get("category", "Uncategorized")
            cat_counts[cat] = cat_counts.get(cat, 0) + d.get("quantity", 0)

        formatted_inventory_data = [
            {"name": k, "value": v} for k, v in cat_counts.items()
        ]

        return {
            "weekly_revenue": round(total_revenue, 2),
            "orders": len(list(
                sales_collection.find({"store_id": store_id, "sale_date": {"$gte": view_start, "$lt": view_end}}))),
            "stock_level": total_stock,
            "critical_items": critical_items,
            "max_offset": 52,
            "top_categories": sorted([{"name": i["_id"], "amount": i["amount"]} for i in category_data],
                                     key=lambda x: x["amount"], reverse=True)[:5],
            "inventory_data": formatted_inventory_data  # <-- FOARTE IMPORTANT: Trebuie returnat!
        }
    except Exception as e:
        print(f"Error in metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{store_id}/sales-forecast")
async def get_store_sales_forecast(
        store_id: str,
        offset: int = 0,
        category: Optional[str] = None,
        current_user: dict = Depends(get_current_user)
):
    try:
        # 1. Determinăm ancora dinamică
        anchor_date = get_anchor_date(store_id)

        # Ne asigurăm că graficul se termină la finalul săptămânii celei mai recente
        now = anchor_date + timedelta(days=1)
        view_end = now - timedelta(days=7 * offset)
        view_start = view_end - timedelta(days=7)

        # 2. Pipeline Vânzări Reale (cu filtrare pe categorie)
        sales_pipeline = [
            {"$match": {"store_id": store_id, "$or": [
                {"sale_date": {"$gte": view_start, "$lt": view_end}},
                {"date": {"$gte": view_start, "$lt": view_end}}
            ]}},
            {"$lookup": {
                "from": "products",
                "let": {"pid": "$product_id"},
                "pipeline": [{"$match": {"$expr": {"$eq": [{"$toString": "$_id"}, "$$pid"]}}}],
                "as": "product_info"
            }},
            {"$unwind": "$product_info"}
        ]
        if category:
            sales_pipeline.append({"$match": {"product_info.category": category}})

        sales_docs = list(sales_collection.aggregate(sales_pipeline))
        sales_map = defaultdict(float)
        for s in sales_docs:
            dt = s.get("sale_date") or s.get("date")
            d_obj = dt if isinstance(dt, datetime) else parser.parse(str(dt))
            sales_map[d_obj.strftime("%b %d")] += float(s.get("total_amount", 0))

        # 3. Procesare Forecast Batch (7 zile)
        # Căutăm documentul care se suprapune cu fereastra vizualizată
        forecast_doc = db["forecasts"].find_one({
            "store_id": store_id,
            "forecast_date": {"$gte": view_start - timedelta(days=7), "$lt": view_end}
        })

        daily_forecast_val = 0
        if forecast_doc:
            if category:
                # Filtrăm produsele din array-ul de 380 de itemi
                cat_products = list(db["products"].find({"category": category}, {"_id": 1}))
                cat_ids = {str(p["_id"]) for p in cat_products}

                total_cat_rev = sum(
                    p.get("revenue_forecast", 0)
                    for p in forecast_doc.get("products", [])
                    if str(p.get("product_id")) in cat_ids
                )
                daily_forecast_val = total_cat_rev / forecast_doc.get("forecast_period_days", 7)
            else:
                # total_revenue_forecast: 575340
                daily_forecast_val = forecast_doc.get("total_revenue_forecast", 0) / 7

        # 4. Generare rezultat pentru 7 zile
        result = []
        for i in range(7, 0, -1):
            day = now - timedelta(days=i + (offset * 7))
            key = day.strftime("%b %d")

            # Verificăm dacă prognoza este validă pentru această zi specifică
            current_day_forecast = 0
            if forecast_doc:
                f_start = forecast_doc["forecast_date"]
                f_start = f_start if isinstance(f_start, datetime) else parser.parse(f_start)
                f_end = f_start + timedelta(days=forecast_doc.get("forecast_period_days", 7))
                if f_start <= day < f_end:
                    current_day_forecast = daily_forecast_val

            result.append({
                "date": key,
                "actual": round(sales_map.get(key, 0), 2),
                "forecast": round(current_day_forecast, 2)
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