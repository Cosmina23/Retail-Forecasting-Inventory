"""
Holidays Router - API endpoints for managing holidays and special events
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from dal.holidays_repo import (
    create_holiday,
    get_holiday_by_id,
    get_holidays_by_market,
    get_holidays_by_date_range,
    get_holidays_by_market_and_date_range,
    update_holiday,
    delete_holiday
)

router = APIRouter(prefix="/api/holidays", tags=["holidays"])


class HolidayCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    event_type: str = Field(..., pattern="^(public_holiday|shopping_event|seasonal)$")
    date: datetime
    market: str = Field(default="Germany", min_length=2)
    impact_level: str = Field(..., pattern="^(high|medium|low)$")
    typical_demand_change: Optional[float] = Field(default=None, ge=-1.0, le=10.0)
    affected_categories: List[str] = Field(default_factory=list)


class HolidayUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    event_type: Optional[str] = Field(None, pattern="^(public_holiday|shopping_event|seasonal)$")
    date: Optional[datetime] = None
    market: Optional[str] = Field(None, min_length=2)
    impact_level: Optional[str] = Field(None, pattern="^(high|medium|low)$")
    typical_demand_change: Optional[float] = Field(None, ge=-1.0, le=10.0)
    affected_categories: Optional[List[str]] = None


@router.get("/")
async def get_holidays(
    market: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """
    Get holidays with optional filters
    """
    try:
        if market and start_date and end_date:
            # Convert string dates to datetime
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            holidays = get_holidays_by_market_and_date_range(market, start_dt, end_dt, skip, limit)
        elif start_date and end_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            holidays = get_holidays_by_date_range(start_dt, end_dt, skip, limit)
        elif market:
            holidays = get_holidays_by_market(market, skip, limit)
        else:
            # Get all holidays (from DB directly)
            from database import holidays_collection
            cursor = holidays_collection.find().skip(skip).limit(limit).sort("date", 1)
            holidays = []
            for doc in cursor:
                if doc.get("_id"):
                    doc["id"] = str(doc["_id"])
                    del doc["_id"]
                holidays.append(doc)
        
        return {
            "holidays": holidays,
            "total": len(holidays),
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        print(f"❌ Error fetching holidays: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching holidays: {str(e)}")


@router.get("/{holiday_id}")
async def get_holiday(holiday_id: str):
    """
    Get a specific holiday by ID
    """
    holiday = get_holiday_by_id(holiday_id)
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return holiday


@router.post("/", status_code=201)
async def create_new_holiday(holiday: HolidayCreate):
    """
    Create a new holiday/event
    """
    try:
        result = create_holiday(
            name=holiday.name,
            event_type=holiday.event_type,
            date=holiday.date,
            market=holiday.market,
            impact_level=holiday.impact_level,
            typical_demand_change=holiday.typical_demand_change,
            affected_categories=holiday.affected_categories
        )
        return result
    except Exception as e:
        print(f"❌ Error creating holiday: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating holiday: {str(e)}")


@router.put("/{holiday_id}")
async def update_holiday_endpoint(holiday_id: str, holiday_update: HolidayUpdate):
    """
    Update an existing holiday
    """
    try:
        # Build update dict with only provided fields
        update_data = {}
        if holiday_update.name is not None:
            update_data["name"] = holiday_update.name
        if holiday_update.event_type is not None:
            update_data["event_type"] = holiday_update.event_type
        if holiday_update.date is not None:
            update_data["date"] = holiday_update.date
        if holiday_update.market is not None:
            update_data["market"] = holiday_update.market
        if holiday_update.impact_level is not None:
            update_data["impact_level"] = holiday_update.impact_level
        if holiday_update.typical_demand_change is not None:
            update_data["typical_demand_change"] = holiday_update.typical_demand_change
        if holiday_update.affected_categories is not None:
            update_data["affected_categories"] = holiday_update.affected_categories
        
        result = update_holiday(holiday_id, update_data)
        if not result:
            raise HTTPException(status_code=404, detail="Holiday not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating holiday: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating holiday: {str(e)}")


@router.delete("/{holiday_id}")
async def delete_holiday_endpoint(holiday_id: str):
    """
    Delete a holiday
    """
    try:
        success = delete_holiday(holiday_id)
        if not success:
            raise HTTPException(status_code=404, detail="Holiday not found")
        return {"message": "Holiday deleted successfully", "id": holiday_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting holiday: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting holiday: {str(e)}")
