"""
Forecasts Repository - Data Access Layer
Handles all database operations for the forecasts collection.
"""

from database import forecasts_collection
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime


def _sanitize_forecast_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Return a sanitized forecast document suitable for API responses."""
    if not doc:
        return {}
    if doc.get("_id"):
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc


def _is_valid_object_id(value: str) -> bool:
    """Validate if the provided string is a valid Mongo ObjectId."""
    try:
        return ObjectId.is_valid(value)
    except Exception:
        return False


def create_forecast(
    product_id: str,
    store_id: Optional[str],
    forecast_data: List[dict],
    accuracy_score: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Create a new forecast record in the database.
    
    Sets generated_at to now.
    """
    now = datetime.utcnow()
    forecast_doc = {
        "product_id": product_id,
        "store_id": store_id,
        "forecast_data": forecast_data,
        "accuracy_score": accuracy_score,
        "generated_at": now,
    }

    result = forecasts_collection.insert_one(forecast_doc)
    forecast_doc["_id"] = result.inserted_id
    return _sanitize_forecast_doc(forecast_doc)


def get_forecast_by_id(forecast_id: str) -> Optional[Dict[str, Any]]:
    """Get a forecast by ID. Returns sanitized forecast or None."""
    if not _is_valid_object_id(forecast_id):
        return None
    forecast = forecasts_collection.find_one({"_id": ObjectId(forecast_id)})
    return _sanitize_forecast_doc(forecast) if forecast else None


def get_forecast_by_product(product_id: str) -> Optional[Dict[str, Any]]:
    """Get the latest forecast for a product (across all stores)."""
    forecast = forecasts_collection.find_one(
        {"product_id": product_id}, sort=[("generated_at", -1)]
    )
    return _sanitize_forecast_doc(forecast) if forecast else None


def get_forecast_by_product_store(
    product_id: str, store_id: str
) -> Optional[Dict[str, Any]]:
    """Get the latest forecast for a product in a specific store."""
    forecast = forecasts_collection.find_one(
        {"product_id": product_id, "store_id": store_id}, sort=[("generated_at", -1)]
    )
    return _sanitize_forecast_doc(forecast) if forecast else None


def list_forecasts(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List all forecasts with pagination. Returns sanitized documents."""
    cursor = forecasts_collection.find().sort("generated_at", -1).skip(skip).limit(limit)
    return [_sanitize_forecast_doc(doc) for doc in cursor]


def get_forecasts_by_store(store_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all forecasts for a store."""
    cursor = (
        forecasts_collection.find({"store_id": store_id})
        .sort("generated_at", -1)
        .skip(skip)
        .limit(limit)
    )
    return [_sanitize_forecast_doc(doc) for doc in cursor]


def update_forecast(forecast_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update a forecast record and return the sanitized updated document.
    
    Allows updating: forecast_data, accuracy_score
    Returns None if not found.
    """
    if not _is_valid_object_id(forecast_id):
        return None

    allowed_fields = {"forecast_data", "accuracy_score"}
    safe_updates = {k: v for k, v in updates.items() if k in allowed_fields}

    result = forecasts_collection.update_one(
        {"_id": ObjectId(forecast_id)}, {"$set": safe_updates}
    )
    if result.matched_count == 0:
        return None

    updated = forecasts_collection.find_one({"_id": ObjectId(forecast_id)})
    return _sanitize_forecast_doc(updated)


def delete_forecast(forecast_id: str) -> bool:
    """Delete a forecast by ID. Returns True if deleted."""
    if not _is_valid_object_id(forecast_id):
        return False
    result = forecasts_collection.delete_one({"_id": ObjectId(forecast_id)})
    return result.deleted_count > 0
