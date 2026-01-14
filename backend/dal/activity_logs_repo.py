from database import activity_logs_collection
from bson import ObjectId
from datetime import datetime
from typing import Optional, List

def create_activity_log(
    store_id: str,
    user_id: str,
    action_type: str,
    description: str,
    details: dict = None,
    metadata: dict = None
) -> str:
    """Create a new activity log entry"""
    log_entry = {
        "store_id": store_id,
        "user_id": user_id,
        "action_type": action_type,
        "description": description,
        "details": details or {},
        "metadata": metadata or {},
        "created_at": datetime.utcnow(),
    }
    result = activity_logs_collection.insert_one(log_entry)
    return str(result.inserted_id)

def get_activity_logs(
    store_id: str,
    limit: int = 50,
    action_type: Optional[str] = None,
    skip: int = 0
) -> List[dict]:
    """Get activity logs for a store"""
    query = {"store_id": store_id}
    if action_type:
        query["action_type"] = action_type

    logs = list(
        activity_logs_collection.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    for log in logs:
        log["_id"] = str(log["_id"])

    return logs

def get_activity_stats(store_id: str) -> dict:
    """Get activity statistics for a store"""
    pipeline = [
        {"$match": {"store_id": store_id}},
        {"$group": {
            "_id": "$action_type",
            "count": {"$sum": 1}
        }}
    ]
    result = list(activity_logs_collection.aggregate(pipeline))
    return {item["_id"]: item["count"] for item in result}