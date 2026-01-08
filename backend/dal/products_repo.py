"""
Products Repository - Data Access Layer
Handles all database operations for products collection.
"""

from database import products_collection
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime
from pymongo.errors import DuplicateKeyError


def _sanitize_product_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Return a sanitized product document suitable for API responses."""
    if not doc:
        return {}
    # Convert ObjectId to string id
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


def create_product(
    name: str,
    sku: str,
    price: float,
    category: Optional[str] = None,
    cost: Optional[float] = None,
    user_id: Optional[str] = None,
    store_ids: Optional[List[str]] = None,
    abc_classification: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new product in the database.

    Notes:
    - Enforces uniqueness on SKU (raises ValueError on duplicate)
    - Adds created_at timestamp
    - Persists optional user_id, store_ids, and abc_classification
    """
    product_doc = {
        "name": name,
        "sku": sku,
        "category": category,
        "price": price,
        "cost": cost,
        "user_id": user_id,
        "store_ids": store_ids or [],
        "abc_classification": abc_classification,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    try:
        result = products_collection.insert_one(product_doc)
        product_doc["_id"] = result.inserted_id
        return _sanitize_product_doc(product_doc)
    except DuplicateKeyError:
        raise ValueError(f"Product with SKU '{sku}' already exists")


def insert_products(docs: List[Dict[str, Any]],store_id:str) -> Dict[str, Any]:
    """
    Bulk insert multiple products into the database.
    
    Args:
        docs: List of product documents to insert
        
    Returns:
        Dictionary with inserted_count and inserted_ids
    
    Notes:
    - Adds created_at and updated_at if not present
    - Does not enforce uniqueness (use create_product for single inserts)
    """
    print("Received store_id:", store_id)
    if not docs:
        return {"inserted_count": 0, "inserted_ids": []}
    
    now = datetime.utcnow()
    for doc in docs:
        if "created_at" not in doc:
            doc["created_at"] = now
        if "updated_at" not in doc:
            doc["updated_at"] = now
        if "store_id" not in doc:
            doc["store_id"]=store_id
    
    result = products_collection.insert_many(docs, ordered=False)
    return {
        "inserted_count": len(result.inserted_ids),
        "inserted_ids": [str(id) for id in result.inserted_ids]
    }


def get_product_by_id(product_id: str) -> Optional[Dict[str, Any]]:
    """Get a product by ID. Returns sanitized product or None."""
    if not _is_valid_object_id(product_id):
        return None
    product = products_collection.find_one({"_id": ObjectId(product_id)})
    return _sanitize_product_doc(product) if product else None


def get_product_by_sku(sku: str) -> Optional[Dict[str, Any]]:
    """Get a product by SKU. Returns sanitized product or None."""
    product = products_collection.find_one({"sku": sku})
    return _sanitize_product_doc(product) if product else None


def get_products_by_user(user_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all products owned by a specific user."""
    cursor = products_collection.find({"user_id": user_id}).skip(skip).limit(limit)
    return [_sanitize_product_doc(doc) for doc in cursor]


def get_products_by_store(store_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all products available in a specific store."""
    cursor = products_collection.find({"store_ids": store_id}).skip(skip).limit(limit)
    return [_sanitize_product_doc(doc) for doc in cursor]


def get_products_by_category(category: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all products in a category."""
    cursor = products_collection.find({"category": category}).skip(skip).limit(limit)
    return [_sanitize_product_doc(doc) for doc in cursor]


def list_products(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List all products with pagination. Returns sanitized documents."""
    cursor = products_collection.find().skip(skip).limit(limit)
    return [_sanitize_product_doc(doc) for doc in cursor]


def update_product(product_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update a product's information and return the sanitized updated document.

    Rules:
    - Prevents SKU updates (keep unique index stable)
    - Allows updating: name, category, price, cost, user_id, store_ids, abc_classification
    - Sets updated_at timestamp
    - Returns None if product not found
    """
    if not _is_valid_object_id(product_id):
        return None

    allowed_fields = {"name", "category", "price", "cost", "user_id", "store_ids", "abc_classification"}
    safe_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    safe_updates["updated_at"] = datetime.utcnow()

    result = products_collection.update_one({"_id": ObjectId(product_id)}, {"$set": safe_updates})
    if result.matched_count == 0:
        return None

    updated = products_collection.find_one({"_id": ObjectId(product_id)})
    return _sanitize_product_doc(updated)


def upsert_product_by_sku(sku: str, product_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Upsert a product by SKU. Creates if not exists, updates if exists.
    
    Returns:
        Sanitized product document with operation indicator in metadata
    """
    now = datetime.utcnow()
    product_data["sku"] = sku
    product_data["updated_at"] = now
    
    # Set created_at only on insert
    result = products_collection.update_one(
        {"sku": sku},
        {
            "$set": product_data,
            "$setOnInsert": {"created_at": now}
        },
        upsert=True
    )
    
    product = products_collection.find_one({"sku": sku})
    return _sanitize_product_doc(product)


def delete_product(product_id: str) -> bool:
    """Delete a product by ID. Returns True if a document was deleted."""
    if not _is_valid_object_id(product_id):
        return False
    result = products_collection.delete_one({"_id": ObjectId(product_id)})
    return result.deleted_count > 0


def delete_product_by_sku(sku: str) -> bool:
    """Delete a product by SKU. Returns True if a document was deleted."""
    result = products_collection.delete_one({"sku": sku})
    return result.deleted_count > 0
