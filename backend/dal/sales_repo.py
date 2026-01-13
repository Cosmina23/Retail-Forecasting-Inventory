def get_sales_summary(days: int = 30) -> dict:
    """
    Return a summary of sales for the last N days: total sales, total quantity, total revenue.
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    pipeline = [
        {"$match": {"sale_date": {"$gte": cutoff_date}}},
        {
            "$group": {
                "_id": None,
                "total_sales": {"$sum": 1},
                "total_quantity": {"$sum": "$quantity"},
                "total_revenue": {"$sum": "$total_amount"},
            }
        },
    ]
    result = list(sales_collection.aggregate(pipeline))
    if result:
        return {
            "total_sales": result[0].get("total_sales", 0),
            "total_quantity": result[0].get("total_quantity", 0),
            "total_revenue": result[0].get("total_revenue", 0.0),
        }
    return {"total_sales": 0, "total_quantity": 0, "total_revenue": 0.0}
"""
Sales Repository - Data Access Layer
Handles all database operations for the sales collection.
"""

from database import sales_collection
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime, timedelta


def _sanitize_sale_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Return a sanitized sale document suitable for API responses."""
    if not doc:
        return {}
    if doc.get("_id"):
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    # Convert datetime objects to ISO format strings for JSON serialization
    if doc.get("sale_date") and isinstance(doc["sale_date"], datetime):
        doc["sale_date"] = doc["sale_date"].isoformat()
    if doc.get("created_at") and isinstance(doc["created_at"], datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


def _is_valid_object_id(value: str) -> bool:
    """Validate if the provided string is a valid Mongo ObjectId."""
    try:
        return ObjectId.is_valid(value)
    except Exception:
        return False


def create_sale(
    product_id: str,
    store_id: str,
    quantity: int,
    total_amount: float,
    sale_date: datetime,
    unit_price: Optional[float] = None,
    day_of_week: Optional[str] = None,
    is_weekend: Optional[bool] = None,
    is_holiday: Optional[bool] = None,
    holiday_name: Optional[str] = None,
    promotion_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new sale record in the database.
    
    Sets created_at to now.
    """
    now = datetime.utcnow()
    sale_doc = {
        "product_id": product_id,
        "store_id": store_id,
        "quantity": quantity,
        "total_amount": total_amount,
        "unit_price": unit_price,
        "sale_date": sale_date,
        "day_of_week": day_of_week,
        "is_weekend": is_weekend,
        "is_holiday": is_holiday,
        "holiday_name": holiday_name,
        "promotion_id": promotion_id,
        "created_at": now,
    }

    result = sales_collection.insert_one(sale_doc)
    sale_doc["_id"] = result.inserted_id
    return _sanitize_sale_doc(sale_doc)


def get_sale_by_id(sale_id: str) -> Optional[Dict[str, Any]]:
    """Get a sale by ID. Returns sanitized sale or None."""
    if not _is_valid_object_id(sale_id):
        return None
    sale = sales_collection.find_one({"_id": ObjectId(sale_id)})
    return _sanitize_sale_doc(sale) if sale else None


def get_sales_by_product(product_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all sales for a product."""
    cursor = sales_collection.find({"product_id": product_id}).skip(skip).limit(limit)
    return [_sanitize_sale_doc(doc) for doc in cursor]


def get_sales_by_store(store_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all sales for a store."""
    cursor = sales_collection.find({"store_id": store_id}).skip(skip).limit(limit)
    return [_sanitize_sale_doc(doc) for doc in cursor]


def get_sales_by_date_range(
    start_date: datetime, end_date: datetime, skip: int = 0, limit: int = 100
) -> List[Dict[str, Any]]:
    """Get sales within a date range."""
    cursor = sales_collection.find(
        {"sale_date": {"$gte": start_date, "$lte": end_date}}
    ).skip(skip).limit(limit)
    return [_sanitize_sale_doc(doc) for doc in cursor]


def list_sales(skip: int = 0, limit: int = 100, days: int = None) -> List[Dict[str, Any]]:
    """List all sales with pagination. Optionally filter by last N days."""
    query = {}
    if days is not None:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        query["sale_date"] = {"$gte": cutoff_date}
        print(f"list_sales: Filtering with days={days}, cutoff_date={cutoff_date}, cutoff_date type={type(cutoff_date)}")
    print(f"list_sales: query={query}, skip={skip}, limit={limit}")
    
    # Get total count for debugging
    total_count = sales_collection.count_documents({})
    filtered_count = sales_collection.count_documents(query)
    print(f"list_sales: Total sales in DB={total_count}, Matching query={filtered_count}")
    
    cursor = sales_collection.find(query).skip(skip).limit(limit)
    results = [_sanitize_sale_doc(doc) for doc in cursor]
    print(f"list_sales: Returned {len(results)} documents after skip/limit")
    if results:
        print(f"list_sales: First sale sample: {results[0]}")
    return results


def sales_by_day(product_id: str, days: int = 30) -> List[Dict[str, Any]]:
    """
    Aggregate sales by day for a product over the last N days.
    Returns list of {_id: date, total_quantity, total_amount, num_transactions}
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    pipeline = [
        {"$match": {"product_id": product_id, "sale_date": {"$gte": cutoff_date}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$sale_date"}},
                "total_quantity": {"$sum": "$quantity"},
                "total_amount": {"$sum": "$total_amount"},
                "num_transactions": {"$sum": 1},
                "avg_unit_price": {"$avg": "$unit_price"},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    return list(sales_collection.aggregate(pipeline))


def sales_by_store_day(store_id: str, days: int = 30) -> List[Dict[str, Any]]:
    """
    Aggregate sales by day for a store over the last N days.
    Returns list of {_id: date, total_quantity, total_amount, num_transactions}
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    pipeline = [
        {"$match": {"store_id": store_id, "sale_date": {"$gte": cutoff_date}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$sale_date"}},
                "total_quantity": {"$sum": "$quantity"},
                "total_amount": {"$sum": "$total_amount"},
                "num_transactions": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    return list(sales_collection.aggregate(pipeline))


def update_sale(sale_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update a sale record and return the sanitized updated document.
    
    Allows updating: quantity, total_amount, unit_price, promotion_id, holiday_name
    Returns None if not found.
    """
    if not _is_valid_object_id(sale_id):
        return None

    allowed_fields = {"quantity", "total_amount", "unit_price", "promotion_id", "holiday_name"}
    safe_updates = {k: v for k, v in updates.items() if k in allowed_fields}

    result = sales_collection.update_one({"_id": ObjectId(sale_id)}, {"$set": safe_updates})
    if result.matched_count == 0:
        return None

    updated = sales_collection.find_one({"_id": ObjectId(sale_id)})
    return _sanitize_sale_doc(updated)


def delete_sale(sale_id: str) -> bool:
    """Delete a sale by ID. Returns True if deleted."""
    if not _is_valid_object_id(sale_id):
        return False
    result = sales_collection.delete_one({"_id": ObjectId(sale_id)})
    return result.deleted_count > 0