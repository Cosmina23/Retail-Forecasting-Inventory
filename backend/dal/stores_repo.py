"""
Stores Repository - Data Access Layer
Handles database operations for the stores collection.
"""

from database import stores_collection
from bson import ObjectId
from typing import Dict, Any, List, Optional
from datetime import datetime

def _sanitize_store_document(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Return a sanitized store document suitable for API responses."""
    if not doc:
        return {}
    if doc.get("_id"):
        doc["id"]=str(doc["_id"])
        del doc["_id"]
    return doc

def _is_valid_store_id(value: str) -> bool:
    """Validate if the provided string is a valid Mongo ObjectId."""
    try:
        return ObjectId.is_valid(value)
    except Exception:
        return False
    
def create_store(
    name: str,
    user_id: str,
    market: str,
    address: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new store in the database.

    Persists: name, user_id, market, address, created_at, is_active
    """
    now = datetime.utcnow()
    store_doc = {
        "name": name,
        "user_id": user_id,
        "market": market,
        "address": address,
        "created_at": now,
        "is_active": True,
    }
    result = stores_collection.insert_one(store_doc)
    store_doc["_id"] = result.inserted_id
    return _sanitize_store_document(store_doc)

def get_store_by_id(store_id: str) -> Optional[Dict[str, Any]]:
    """Get a store by ID. Returns sanitized store or None."""
    if not _is_valid_store_id(store_id):
        return None
    store = stores_collection.find_one({"_id": ObjectId(store_id)})
    return _sanitize_store_document(store) if store else None

def get_stores_by_user(user_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get stores owned/managed by a specific user."""
    cursor = stores_collection.find({"user_id": user_id}).skip(skip).limit(limit)
    return [_sanitize_store_document(doc) for doc in cursor]

# Backward-compatible alias if previously used
def get_store_by_userId(user_id: str) -> List[Dict[str, Any]]:  # type: ignore
    return get_stores_by_user(user_id)

def update_store(store_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update a store's information and return the sanitized updated document.

    Allows updating: name, market, address, is_active
    Sets updated_at timestamp. Returns None if not found.
    """
    if not _is_valid_store_id(store_id):
        return None

    allowed_fields = {"name", "market", "address", "is_active"}
    safe_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    safe_updates["updated_at"] = datetime.utcnow()

    result = stores_collection.update_one({"_id": ObjectId(store_id)}, {"$set": safe_updates})
    if result.matched_count == 0:
        return None

    updated = stores_collection.find_one({"_id": ObjectId(store_id)})
    return _sanitize_store_document(updated)
    
def deactivate_store(store_id: str) -> bool:
    """Soft-deactivate a store by setting is_active=False. Returns True if updated."""
    if not _is_valid_store_id(store_id):
        return False
    result = stores_collection.update_one(
        {"_id": ObjectId(store_id)}, {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    return result.matched_count > 0


def get_stores_by_market(market: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get stores in a given market (region)."""
    cursor = stores_collection.find({"market": market}).skip(skip).limit(limit)
    return [_sanitize_store_document(doc) for doc in cursor]


def list_stores(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List stores with pagination. Returns sanitized documents."""
    cursor = stores_collection.find().skip(skip).limit(limit)
    return [_sanitize_store_document(doc) for doc in cursor]


def delete_store(store_id: str) -> bool:
    """Hard delete a store by ID. Returns True if a document was deleted."""
    if not _is_valid_store_id(store_id):
        return False
    result = stores_collection.delete_one({"_id": ObjectId(store_id)})
    return result.deleted_count > 0