"""
Inventory Repository - Data Access Layer
Handles database operations for inventory collection.
"""

from database import inventory_collection
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime


def _sanitize_inventory_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Return a sanitized inventory document suitable for API responses."""
    if not doc:
        return {}
    if doc.get("_id"):
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    # Calculate available_quantity on-the-fly: quantity - reserved_quantity
    if "quantity" in doc and "reserved_quantity" in doc:
        doc["available_quantity"] = doc["quantity"] - doc["reserved_quantity"]
    
    # Calculate total holding cost: quantity * holding_cost_per_unit
    if "quantity" in doc and "holding_cost_per_unit" in doc and doc.get("holding_cost_per_unit"):
        doc["total_holding_cost"] = doc["quantity"] * doc["holding_cost_per_unit"]
    else:
        doc["total_holding_cost"] = 0
    
    # Calculate total stockout penalty: quantity * stockout_penalty
    if "quantity" in doc and "stockout_penalty" in doc and doc.get("stockout_penalty"):
        doc["total_stockout_penalty"] = doc["quantity"] * doc["stockout_penalty"]
    else:
        doc["total_stockout_penalty"] = 0
    
    return doc


def _is_valid_object_id(value: str) -> bool:
    """Validate if the provided string is a valid Mongo ObjectId."""
    try:
        return ObjectId.is_valid(value)
    except Exception:
        return False


def create_inventory(
    product_id: str,
    store_id: str,
    quantity: int,
    reserved_quantity: int = 0,
    reorder_point: int = 0,
    reorder_quantity: int = 0,
    safety_stock: int = 0,
    holding_cost_per_unit: Optional[float] = None,
    stockout_penalty: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Create a new inventory item in the database.

    Notes:
    - Unique on (product_id, store_id) via index
    - available_quantity is calculated as quantity - reserved_quantity
    - Sets last_updated to now
    """
    now = datetime.utcnow()
    inventory_doc = {
        "product_id": product_id,
        "store_id": store_id,
        "quantity": quantity,
        "reserved_quantity": reserved_quantity,
        "reorder_point": reorder_point,
        "reorder_quantity": reorder_quantity,
        "safety_stock": safety_stock,
        "holding_cost_per_unit": holding_cost_per_unit,
        "stockout_penalty": stockout_penalty,
        "last_updated": now,
        "last_counted": None,
    }

    result = inventory_collection.insert_one(inventory_doc)
    inventory_doc["_id"] = result.inserted_id
    return _sanitize_inventory_doc(inventory_doc)


def get_inventory_by_id(inventory_id: str) -> Optional[Dict[str, Any]]:
    """Get an inventory item by ID. Returns sanitized item or None."""
    if not _is_valid_object_id(inventory_id):
        return None
    item = inventory_collection.find_one({"_id": ObjectId(inventory_id)})
    return _sanitize_inventory_doc(item) if item else None


def get_inventory_by_product_store(product_id: str, store_id: str) -> Optional[Dict[str, Any]]:
    """Get inventory item for a specific product in a store."""
    item = inventory_collection.find_one({"product_id": product_id, "store_id": store_id})
    return _sanitize_inventory_doc(item) if item else None


def get_inventory_by_store(store_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all inventory items for a store with pagination."""
    cursor = inventory_collection.find({"store_id": store_id}).skip(skip).limit(limit)
    return [_sanitize_inventory_doc(doc) for doc in cursor]


def get_inventory_by_product(product_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all inventory entries for a product across stores with pagination."""
    cursor = inventory_collection.find({"product_id": product_id}).skip(skip).limit(limit)
    return [_sanitize_inventory_doc(doc) for doc in cursor]


def list_inventory(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List all inventory items with pagination. Returns sanitized documents."""
    cursor = inventory_collection.find().skip(skip).limit(limit)
    return [_sanitize_inventory_doc(doc) for doc in cursor]


def get_low_stock(store_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Get low-stock items for a store where available_quantity <= reorder_point.
    
    available_quantity = quantity - reserved_quantity
    """
    cursor = inventory_collection.find(
        {
            "store_id": store_id,
            "$expr": {"$lte": [{"$subtract": ["$quantity", "$reserved_quantity"]}, "$reorder_point"]},
        }
    ).skip(skip).limit(limit)
    return [_sanitize_inventory_doc(doc) for doc in cursor]


def update_inventory(inventory_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update an inventory item and return the sanitized updated document.

    Allows updating: quantity, reserved_quantity, reorder_point, reorder_quantity,
    safety_stock, holding_cost_per_unit, stockout_penalty, last_counted
    Sets last_updated. Returns None if not found.
    """
    if not _is_valid_object_id(inventory_id):
        return None

    allowed_fields = {
        "quantity",
        "reserved_quantity",
        "reorder_point",
        "reorder_quantity",
        "safety_stock",
        "holding_cost_per_unit",
        "stockout_penalty",
        "last_counted",
    }
    safe_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    safe_updates["last_updated"] = datetime.utcnow()

    result = inventory_collection.update_one({"_id": ObjectId(inventory_id)}, {"$set": safe_updates})
    if result.matched_count == 0:
        return None

    updated = inventory_collection.find_one({"_id": ObjectId(inventory_id)})
    return _sanitize_inventory_doc(updated)


def adjust_stock(product_id: str, store_id: str, delta: int) -> Optional[Dict[str, Any]]:
    """
    Adjust quantity for a product in a store by delta (positive or negative).
    Updates last_updated timestamp and returns the sanitized updated document.
    Returns None if item not found.
    """
    result = inventory_collection.update_one(
        {"product_id": product_id, "store_id": store_id},
        {"$inc": {"quantity": delta}, "$set": {"last_updated": datetime.utcnow()}},
    )

    if result.matched_count == 0:
        return None

    updated = inventory_collection.find_one({"product_id": product_id, "store_id": store_id})
    return _sanitize_inventory_doc(updated)


def reserve_stock(product_id: str, store_id: str, reserve_qty: int) -> Optional[Dict[str, Any]]:
    """
    Reserve stock for a product in a store (increment reserved_quantity).
    Updates last_updated and returns the sanitized updated document.
    Returns None if item not found.
    """
    result = inventory_collection.update_one(
        {"product_id": product_id, "store_id": store_id},
        {"$inc": {"reserved_quantity": reserve_qty}, "$set": {"last_updated": datetime.utcnow()}},
    )

    if result.matched_count == 0:
        return None

    updated = inventory_collection.find_one({"product_id": product_id, "store_id": store_id})
    return _sanitize_inventory_doc(updated)


def upsert_inventory(
    product_id: str,
    store_id: str,
    quantity: int,
    reserved_quantity: int = 0,
    **kwargs,
) -> Dict[str, Any]:
    """
    Upsert an inventory item by product_id and store_id.
    Creates if not exists, updates if exists.
    Returns sanitized inventory item.
    """
    now = datetime.utcnow()
    inventory_data = {
        "product_id": product_id,
        "store_id": store_id,
        "quantity": quantity,
        "reserved_quantity": reserved_quantity,
        **kwargs,
    }

    result = inventory_collection.update_one(
        {"product_id": product_id, "store_id": store_id},
        {
            "$set": {**inventory_data, "last_updated": now},
            "$setOnInsert": {"last_counted": None},
        },
        upsert=True,
    )

    item = inventory_collection.find_one({"product_id": product_id, "store_id": store_id})
    return _sanitize_inventory_doc(item)


def delete_inventory(inventory_id: str) -> bool:
    """Hard delete an inventory item by ID. Returns True if deleted."""
    if not _is_valid_object_id(inventory_id):
        return False
    result = inventory_collection.delete_one({"_id": ObjectId(inventory_id)})
    return result.deleted_count > 0