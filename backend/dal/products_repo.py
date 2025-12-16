"""
Products Repository - Data Access Layer
Handles all database operations for products collection.
"""

from database import products_collection
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime


def insert_products(docs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Insert multiple products into the database.
    
    Args:
        docs: List of product documents to insert
        
    Returns:
        Dictionary with inserted_count and inserted_ids
    """
    if not docs:
        return {"inserted_count": 0, "inserted_ids": []}
    
    # Add created_at timestamp if not present
    for doc in docs:
        if "created_at" not in doc:
            doc["created_at"] = datetime.utcnow()
    
    result = products_collection.insert_many(docs)
    
    return {
        "inserted_count": len(result.inserted_ids),
        "inserted_ids": [str(id) for id in result.inserted_ids]
    }


def get_all_products(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all products with pagination."""
    products = list(products_collection.find().skip(skip).limit(limit))
    for p in products:
        p["id"] = str(p.get("_id", ""))
    return products


def get_product_by_sku(sku: str) -> Optional[Dict[str, Any]]:
    """Get a product by SKU."""
    product = products_collection.find_one({"sku": sku})
    if product:
        product["id"] = str(product.get("_id", ""))
    return product


def get_products_by_category(category: str) -> List[Dict[str, Any]]:
    """Get all products in a category."""
    products = list(products_collection.find({"category": category}))
    for p in products:
        p["id"] = str(p.get("_id", ""))
    return products
