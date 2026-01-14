from fastapi import APIRouter, Query, Depends, HTTPException
from typing import Optional, List
from dal import activity_logs_repo
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/activity-logs", tags=["activity-logs"])

class ActivityLogCreate(BaseModel):
    store_id: str
    user_id: str
    action_type: str
    description: str
    details: Optional[dict] = None
    metadata: Optional[dict] = None

class ActivityLogResponse(BaseModel):
    _id: str
    store_id: str
    user_id: str
    action_type: str
    description: str
    details: dict
    metadata: dict
    created_at: datetime

@router.post("/")
async def create_activity_log(log: ActivityLogCreate):
    """Create a new activity log"""
    log_id = activity_logs_repo.create_activity_log(
        store_id=log.store_id,
        user_id=log.user_id,
        action_type=log.action_type,
        description=log.description,
        details=log.details,
        metadata=log.metadata
    )
    return {"id": log_id, "message": "Activity logged successfully"}

@router.get("/")
async def get_activity_logs(
    store_id: str = Query(...),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    action_type: Optional[str] = Query(None)
):
    """Get activity logs for a store"""
    logs = activity_logs_repo.get_activity_logs(
        store_id=store_id,
        limit=limit,
        skip=skip,
        action_type=action_type
    )
    return logs

@router.get("/stats")
async def get_activity_stats(store_id: str = Query(...)):
    """Get activity statistics"""
    stats = activity_logs_repo.get_activity_stats(store_id)
    return stats