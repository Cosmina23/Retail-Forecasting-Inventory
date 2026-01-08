"""
Purchase Orders Repository - Data Access Layer
Handles all database operations for the purchase_orders collection.
"""

from database import purchase_orders_collection
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime


def _sanitize_po_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Return a sanitized purchase order document suitable for API responses."""
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


def create_purchase_order(
    po_number: str,
    store_id: str,
    supplier_name: str,
    items: List[dict],
    total_cost: float,
    status: str = "draft",
    expected_delivery_date: Optional[datetime] = None,
    currency: str = "EUR",
    notes: Optional[str] = None,
    created_by: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new purchase order in the database.
    
    Sets created_at and order_date to now.
    """
    now = datetime.utcnow()
    po_doc = {
        "po_number": po_number,
        "store_id": store_id,
        "supplier_name": supplier_name,
        "items": items,
        "total_cost": total_cost,
        "status": status,
        "order_date": now,
        "expected_delivery_date": expected_delivery_date,
        "currency": currency,
        "notes": notes,
        "created_by": created_by,
        "created_at": now,
    }

    result = purchase_orders_collection.insert_one(po_doc)
    po_doc["_id"] = result.inserted_id
    return _sanitize_po_doc(po_doc)


def get_po_by_id(po_id: str) -> Optional[Dict[str, Any]]:
    """Get a purchase order by ID. Returns sanitized PO or None."""
    if not _is_valid_object_id(po_id):
        return None
    po = purchase_orders_collection.find_one({"_id": ObjectId(po_id)})
    return _sanitize_po_doc(po) if po else None


def get_po_by_number(po_number: str) -> Optional[Dict[str, Any]]:
    """Get a purchase order by PO number."""
    po = purchase_orders_collection.find_one({"po_number": po_number})
    return _sanitize_po_doc(po) if po else None


def get_pos_by_store(store_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all purchase orders for a store."""
    cursor = purchase_orders_collection.find({"store_id": store_id}).skip(skip).limit(limit)
    return [_sanitize_po_doc(doc) for doc in cursor]


def get_pos_by_status(status: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all purchase orders with a specific status (draft, sent, confirmed, received, cancelled)."""
    cursor = purchase_orders_collection.find({"status": status}).skip(skip).limit(limit)
    return [_sanitize_po_doc(doc) for doc in cursor]


def get_pos_by_store_status(
    store_id: str, status: str, skip: int = 0, limit: int = 100
) -> List[Dict[str, Any]]:
    """Get purchase orders for a store with a specific status."""
    cursor = purchase_orders_collection.find(
        {"store_id": store_id, "status": status}
    ).skip(skip).limit(limit)
    return [_sanitize_po_doc(doc) for doc in cursor]


def list_purchase_orders(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List all purchase orders with pagination. Returns sanitized documents."""
    cursor = purchase_orders_collection.find().skip(skip).limit(limit)
    return [_sanitize_po_doc(doc) for doc in cursor]


def update_purchase_order(po_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update a purchase order and return the sanitized updated document.
    
    Allows updating: status, expected_delivery_date, actual_delivery_date, notes
    Sets updated_at. Returns None if not found.
    """
    if not _is_valid_object_id(po_id):
        return None

    allowed_fields = {
        "status",
        "expected_delivery_date",
        "actual_delivery_date",
        "notes",
    }
    safe_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    safe_updates["updated_at"] = datetime.utcnow()

    result = purchase_orders_collection.update_one(
        {"_id": ObjectId(po_id)}, {"$set": safe_updates}
    )
    if result.matched_count == 0:
        return None

    updated = purchase_orders_collection.find_one({"_id": ObjectId(po_id)})
    return _sanitize_po_doc(updated)


def delete_purchase_order(po_id: str) -> bool:
    """Delete a purchase order by ID. Returns True if deleted."""
    if not _is_valid_object_id(po_id):
        return False
    result = purchase_orders_collection.delete_one({"_id": ObjectId(po_id)})
    return result.deleted_count > 0
