from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional
from utils.auth import get_current_user
from dal.sales_repo import (
    list_sales,
    get_sales_summary,
    get_sales_by_store,
    get_sales_by_product,
)

router = APIRouter()

@router.get("/", response_model=List[dict])
async def get_sales(skip: int = 0, limit: int = 100, days: Optional[int] = None, current_user: str = Depends(get_current_user)):
    """Get all sales, optionally filter by days."""
    return list_sales(skip=skip, limit=limit, days=days)

@router.get("/summary", response_model=dict)
async def sales_summary(days: int = 30, current_user: str = Depends(get_current_user)):
    """Get sales summary for the last N days."""
    return get_sales_summary(days=days)

# Add more endpoints as needed (by store, by product, etc.)
