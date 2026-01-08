"""
Promotions Repository - Data Access Layer
Handles all database operations for the promotions collection.
"""

from database import promotions_collection
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime


def _sanitize_promotion_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Return a sanitized promotion document suitable for API responses."""
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


def create_promotion(
    name: str,
    promotion_type: str,
    start_date: datetime,
    end_date: datetime,
    store_ids: Optional[List[str]] = None,
    product_ids: Optional[List[str]] = None,
    discount_percentage: Optional[float] = None,
    description: Optional[str] = None,
    is_active: bool = True,
) -> Dict[str, Any]:
    """
    Create a new promotion in the database.
    
    Sets created_at to now.
    """
    now = datetime.utcnow()
    promotion_doc = {
        "name": name,
        "description": description,
        "promotion_type": promotion_type,
        "store_ids": store_ids or [],
        "product_ids": product_ids or [],
        "discount_percentage": discount_percentage,
        "start_date": start_date,
        "end_date": end_date,
        "is_active": is_active,
        "created_at": now,
    }

    result = promotions_collection.insert_one(promotion_doc)
    promotion_doc["_id"] = result.inserted_id
    return _sanitize_promotion_doc(promotion_doc)


def get_promotion_by_id(promotion_id: str) -> Optional[Dict[str, Any]]:
    """Get a promotion by ID. Returns sanitized promotion or None."""
    if not _is_valid_object_id(promotion_id):
        return None
    promotion = promotions_collection.find_one({"_id": ObjectId(promotion_id)})
    return _sanitize_promotion_doc(promotion) if promotion else None


def get_active_promotions(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all active promotions (is_active=True and current date in range)."""
    now = datetime.utcnow()
    cursor = promotions_collection.find(
        {
            "is_active": True,
            "start_date": {"$lte": now},
            "end_date": {"$gte": now},
        }
    ).skip(skip).limit(limit)
    return [_sanitize_promotion_doc(doc) for doc in cursor]


def get_promotions_by_store(store_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all active promotions applicable to a store."""
    now = datetime.utcnow()
    cursor = promotions_collection.find(
        {
            "store_ids": store_id,
            "is_active": True,
            "start_date": {"$lte": now},
            "end_date": {"$gte": now},
        }
    ).skip(skip).limit(limit)
    return [_sanitize_promotion_doc(doc) for doc in cursor]


def get_promotions_by_product(product_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all active promotions applicable to a product."""
    now = datetime.utcnow()
    cursor = promotions_collection.find(
        {
            "product_ids": product_id,
            "is_active": True,
            "start_date": {"$lte": now},
            "end_date": {"$gte": now},
        }
    ).skip(skip).limit(limit)
    return [_sanitize_promotion_doc(doc) for doc in cursor]


def list_promotions(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List all promotions with pagination. Returns sanitized documents."""
    cursor = promotions_collection.find().skip(skip).limit(limit)
    return [_sanitize_promotion_doc(doc) for doc in cursor]


def update_promotion(promotion_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update a promotion and return the sanitized updated document.
    
    Allows updating: name, description, discount_percentage, start_date, end_date, 
    store_ids, product_ids, is_active
    Returns None if not found.
    """
    if not _is_valid_object_id(promotion_id):
        return None

    allowed_fields = {
        "name",
        "description",
        "discount_percentage",
        "start_date",
        "end_date",
        "store_ids",
        "product_ids",
        "is_active",
    }
    safe_updates = {k: v for k, v in updates.items() if k in allowed_fields}

    result = promotions_collection.update_one(
        {"_id": ObjectId(promotion_id)}, {"$set": safe_updates}
    )
    if result.matched_count == 0:
        return None

    updated = promotions_collection.find_one({"_id": ObjectId(promotion_id)})
    return _sanitize_promotion_doc(updated)


def delete_promotion(promotion_id: str) -> bool:
    """Delete a promotion by ID. Returns True if deleted."""
    if not _is_valid_object_id(promotion_id):
        return False
    result = promotions_collection.delete_one({"_id": ObjectId(promotion_id)})
    return result.deleted_count > 0
