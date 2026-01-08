"""
Import Logs Repository - Data Access Layer
Handles all database operations for the import_logs collection.
"""

from database import import_logs_collection
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime


def _sanitize_import_log_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Return a sanitized import log document suitable for API responses."""
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


def create_import_log(
    run_id: str,
    level: str,
    message: str,
    collection: Optional[str] = None,
    record_ref: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Create a new import log entry.
    
    Sets timestamp to now.
    """
    now = datetime.utcnow()
    log_doc = {
        "run_id": run_id,
        "level": level,
        "collection": collection,
        "record_ref": record_ref,
        "message": message,
        "timestamp": now,
    }

    result = import_logs_collection.insert_one(log_doc)
    log_doc["_id"] = result.inserted_id
    return _sanitize_import_log_doc(log_doc)


def get_import_log_by_id(log_id: str) -> Optional[Dict[str, Any]]:
    """Get an import log by ID. Returns sanitized log or None."""
    if not _is_valid_object_id(log_id):
        return None
    log = import_logs_collection.find_one({"_id": ObjectId(log_id)})
    return _sanitize_import_log_doc(log) if log else None


def get_logs_by_run_id(run_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all logs for a specific import run."""
    cursor = import_logs_collection.find({"run_id": run_id}).sort("timestamp", 1).skip(skip).limit(limit)
    return [_sanitize_import_log_doc(doc) for doc in cursor]


def get_logs_by_run_id_and_level(
    run_id: str, level: str, skip: int = 0, limit: int = 100
) -> List[Dict[str, Any]]:
    """Get logs for a specific run filtered by level (info, warn, error)."""
    cursor = import_logs_collection.find(
        {"run_id": run_id, "level": level}
    ).sort("timestamp", 1).skip(skip).limit(limit)
    return [_sanitize_import_log_doc(doc) for doc in cursor]


def get_error_logs_by_run_id(run_id: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all error logs for a specific run."""
    cursor = import_logs_collection.find(
        {"run_id": run_id, "level": "error"}
    ).sort("timestamp", 1).skip(skip).limit(limit)
    return [_sanitize_import_log_doc(doc) for doc in cursor]


def get_logs_by_collection(
    collection: str, skip: int = 0, limit: int = 100
) -> List[Dict[str, Any]]:
    """Get all logs for a specific collection across all runs."""
    cursor = import_logs_collection.find({"collection": collection}).sort("timestamp", -1).skip(skip).limit(limit)
    return [_sanitize_import_log_doc(doc) for doc in cursor]


def list_import_logs(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List all import logs with pagination. Returns sanitized documents."""
    cursor = import_logs_collection.find().sort("timestamp", -1).skip(skip).limit(limit)
    return [_sanitize_import_log_doc(doc) for doc in cursor]


def delete_logs_by_run_id(run_id: str) -> int:
    """Delete all logs for a specific import run. Returns count of deleted documents."""
    result = import_logs_collection.delete_many({"run_id": run_id})
    return result.deleted_count


def delete_import_log(log_id: str) -> bool:
    """Delete an import log by ID. Returns True if deleted."""
    if not _is_valid_object_id(log_id):
        return False
    result = import_logs_collection.delete_one({"_id": ObjectId(log_id)})
    return result.deleted_count > 0
