from fastapi import APIRouter, HTTPException, Query
from database import db
from bson import ObjectId
from typing import List, Optional
from datetime import datetime, timedelta

router = APIRouter(prefix="/forecasts", tags=["forecasts"])

forecasts_collection = db["forecasts"]
sales_collection = db["sales"]
products_collection = db["products"]


@router.get("/weekly")
async def get_weekly_forecasts(store_id: Optional[str] = Query(None)):
    """Returnează DOAR prognozele salvate în baza de date pentru un magazin"""
    query = {"store_id": store_id} if store_id else {}

    # Căutăm prognozele reale în colecția 'forecasts'
    cursor = forecasts_collection.find(query).sort("forecast_date", -1).limit(4)

    weekly_data = []
    for forecast in cursor:
        weekly_data.append({
            "id": str(forecast["_id"]),
            "week": forecast.get("week_label", "N/A"),  # Presupunând că ai un câmp de nume
            "predicted": forecast.get("forecast_demand", 0),
            "lower": forecast.get("lower_bound", 0),
            "upper": forecast.get("upper_bound", 0),
        })

    return weekly_data


@router.get("/category")
async def get_category_forecasts(store_id: Optional[str] = Query(None)):
    """Returnează datele de prognoză pe categorii, fără multiplicatori ficți"""
    # Dacă vrei prognoze pe categorii fără mock, acestea ar trebui
    # să vină dintr-o colecție unde ai salvat rezultatele modelului ML.
    # Dacă nu ai o astfel de colecție, returnăm lista goală.

    query = {"store_id": store_id} if store_id else {}

    # Exemplu: Căutăm prognoze care au și câmpul 'category'
    cursor = forecasts_collection.find({**query, "category": {"$exists": True}})

    category_data = []
    for f in cursor:
        category_data.append({
            "category": f.get("category"),
            "current": f.get("current_value", 0),
            "forecast": f.get("forecast_value", 0)
        })

    return category_data


@router.get("/")
async def get_forecasts(store_id: Optional[str] = Query(None)):
    """Toate prognozele brute din DB"""
    query = {"store_id": store_id} if store_id else {}

    forecasts = []
    for forecast in forecasts_collection.find(query).sort("forecast_date", -1):
        forecast["id"] = str(forecast["_id"])
        forecast.pop("_id", None)
        forecasts.append(forecast)

    return forecasts


@router.post("/")
async def create_forecast(forecast: dict):
    """Creare prognoză reală (venită probabil din scriptul de ML)"""
    if "forecast_date" not in forecast:
        forecast["forecast_date"] = datetime.utcnow().isoformat()

    result = forecasts_collection.insert_one(forecast)
    forecast["id"] = str(result.inserted_id)
    forecast.pop("_id", None)
    return forecast