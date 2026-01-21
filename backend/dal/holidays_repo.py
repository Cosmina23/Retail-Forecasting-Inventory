"""
Holidays Repository - Data Access Layer
Handles all database operations for the holidays_events collection.
"""

from database import holidays_collection
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime


def _sanitize_holiday_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Return a sanitized holiday document suitable for API responses."""
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


def create_holiday(
    name: str,
    event_type: str,
    date: datetime,
    market: str,
    impact_level: str,
    typical_demand_change: Optional[float] = None,
    affected_categories: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Create a new holiday/event record in the database.
    
    Sets created_at to now.
    """
    now = datetime.utcnow()
    holiday_doc = {
        "name": name,
        "event_type": event_type,
        "date": date,
        "market": market,
        "impact_level": impact_level,
        "typical_demand_change": typical_demand_change,
        "affected_categories": affected_categories or [],
        "created_at": now,
    }

    result = holidays_collection.insert_one(holiday_doc)
    holiday_doc["_id"] = result.inserted_id
    return _sanitize_holiday_doc(holiday_doc)


def get_holiday_by_id(holiday_id: str) -> Optional[Dict[str, Any]]:
    """Get a holiday by ID. Returns sanitized holiday or None."""
    if not _is_valid_object_id(holiday_id):
        return None
    holiday = holidays_collection.find_one({"_id": ObjectId(holiday_id)})
    return _sanitize_holiday_doc(holiday) if holiday else None


def get_holidays_by_market(market: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all holidays for a specific market/region."""
    cursor = holidays_collection.find({"market": market}).skip(skip).limit(limit)
    return [_sanitize_holiday_doc(doc) for doc in cursor]


def get_holidays_by_date_range(
    start_date: datetime, end_date: datetime, skip: int = 0, limit: int = 100
) -> List[Dict[str, Any]]:
    """Get holidays within a date range."""
    cursor = holidays_collection.find(
        {"date": {"$gte": start_date, "$lte": end_date}}
    ).skip(skip).limit(limit)
    return [_sanitize_holiday_doc(doc) for doc in cursor]


def get_holidays_by_market_and_date_range(
    market: str, start_date: datetime, end_date: datetime, skip: int = 0, limit: int = 100
) -> List[Dict[str, Any]]:
    """Get holidays for a specific market within a date range. Also returns holidays marked for 'all' markets."""
    cursor = holidays_collection.find(
        {
            "$or": [
                {"market": market},
                {"market": "all"}
            ],
            "date": {"$gte": start_date, "$lte": end_date},
        }
    ).skip(skip).limit(limit)
    return [_sanitize_holiday_doc(doc) for doc in cursor]


def get_holidays_by_event_type(
    event_type: str, skip: int = 0, limit: int = 100
) -> List[Dict[str, Any]]:
    """Get all holidays of a specific type (public_holiday, shopping_event, seasonal)."""
    cursor = holidays_collection.find({"event_type": event_type}).skip(skip).limit(limit)
    return [_sanitize_holiday_doc(doc) for doc in cursor]


def list_holidays(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List all holidays with pagination. Returns sanitized documents."""
    cursor = holidays_collection.find().skip(skip).limit(limit)
    return [_sanitize_holiday_doc(doc) for doc in cursor]


def update_holiday(holiday_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update a holiday record and return the sanitized updated document.
    
    Allows updating: name, event_type, date, market, impact_level, typical_demand_change, affected_categories
    Returns None if not found.
    """
    if not _is_valid_object_id(holiday_id):
        return None

    allowed_fields = {
        "name",
        "event_type",
        "date",
        "market",
        "impact_level",
        "typical_demand_change",
        "affected_categories",
    }
    safe_updates = {k: v for k, v in updates.items() if k in allowed_fields}

    result = holidays_collection.update_one(
        {"_id": ObjectId(holiday_id)}, {"$set": safe_updates}
    )
    if result.matched_count == 0:
        return None

    updated = holidays_collection.find_one({"_id": ObjectId(holiday_id)})
    return _sanitize_holiday_doc(updated)


def delete_holiday(holiday_id: str) -> bool:
    """Delete a holiday by ID. Returns True if deleted."""
    if not _is_valid_object_id(holiday_id):
        return False
    result = holidays_collection.delete_one({"_id": ObjectId(holiday_id)})
    return result.deleted_count > 0
