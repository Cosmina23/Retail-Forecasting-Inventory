from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from models import Store, StoreCreate
from utils.auth import get_current_user
from dal.stores_repo import create_store, get_store_by_id, get_stores_by_user

router = APIRouter()

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_store_endpoint(store: StoreCreate, current_user: str = Depends(get_current_user)):
    """Create a new store."""
    try:
        created = create_store(
            name=store.name,
            user_id=current_user,
            market=store.market,
            address=store.address,
        )
        return created
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/me", response_model=List[dict])
async def get_my_stores(current_user: str = Depends(get_current_user)):
    """Get all stores for the current user."""
    return get_stores_by_user(current_user)

@router.get("/{store_id}", response_model=dict)
async def get_store(store_id: str, current_user: str = Depends(get_current_user)):
    """Get a store by ID."""
    store = get_store_by_id(store_id)
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    return store
