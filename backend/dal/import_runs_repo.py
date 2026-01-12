"""
Import Runs Repository - Data Access Layer
Handles all database operations for the import_runs collection.
"""

from database import import_runs_collection
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime


def _sanitize_import_run_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Return a sanitized import run document suitable for API responses."""
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


def create_import_run(
    run_id: str,
    source: str,
    collections: List[str],
) -> Dict[str, Any]:
    """
    Create a new import run record with status=running.
    
    Sets started_at to now.
    """
    now = datetime.utcnow()
    run_doc = {
        "run_id": run_id,
        "source": source,
        "collections": collections,
        "status": "running",
        "started_at": now,
        "finished_at": None,
        "stats": None,
        "error": None,
        "notes": None,
    }

    result = import_runs_collection.insert_one(run_doc)
    run_doc["_id"] = result.inserted_id
    return _sanitize_import_run_doc(run_doc)


def get_import_run_by_id(run_doc_id: str) -> Optional[Dict[str, Any]]:
    """Get an import run by document ID. Returns sanitized run or None."""
    if not _is_valid_object_id(run_doc_id):
        return None
    run = import_runs_collection.find_one({"_id": ObjectId(run_doc_id)})
    return _sanitize_import_run_doc(run) if run else None


def get_import_run_by_run_id(run_id: str) -> Optional[Dict[str, Any]]:
    """Get an import run by run_id (unique identifier from source)."""
    run = import_runs_collection.find_one({"run_id": run_id})
    return _sanitize_import_run_doc(run) if run else None


def get_import_runs_by_status(status: str, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """Get all import runs with a specific status (running, success, failed)."""
    cursor = import_runs_collection.find({"status": status}).sort("started_at", -1).skip(skip).limit(limit)
    return [_sanitize_import_run_doc(doc) for doc in cursor]


def get_latest_import_run() -> Optional[Dict[str, Any]]:
    """Get the most recent import run."""
    run = import_runs_collection.find_one(sort=[("started_at", -1)])
    return _sanitize_import_run_doc(run) if run else None


def list_import_runs(skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
    """List all import runs with pagination. Returns sanitized documents."""
    cursor = import_runs_collection.find().sort("started_at", -1).skip(skip).limit(limit)
    return [_sanitize_import_run_doc(doc) for doc in cursor]


def update_import_run(
    run_doc_id: str,
    status: str,
    stats: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
    notes: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Update an import run with final status and stats.
    
    Sets finished_at to now. Returns sanitized updated document or None if not found.
    """
    if not _is_valid_object_id(run_doc_id):
        return None

    now = datetime.utcnow()
    updates = {
        "status": status,
        "finished_at": now,
        "stats": stats,
        "error": error,
        "notes": notes,
    }

    result = import_runs_collection.update_one(
        {"_id": ObjectId(run_doc_id)}, {"$set": updates}
    )
    if result.matched_count == 0:
        return None

    updated = import_runs_collection.find_one({"_id": ObjectId(run_doc_id)})
    return _sanitize_import_run_doc(updated)


def delete_import_run(run_doc_id: str) -> bool:
    """Delete an import run by ID. Returns True if deleted."""
    if not _is_valid_object_id(run_doc_id):
        return False
    result = import_runs_collection.delete_one({"_id": ObjectId(run_doc_id)})
    return result.deleted_count > 0
