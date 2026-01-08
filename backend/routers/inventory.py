from fastapi import APIRouter, HTTPException, Depends
from typing import List
from dal.inventory_repo import get_inventory_by_store, get_low_stock
from dal.stores_repo import get_store_by_id
from database import products_collection
from utils.auth import get_current_user
from bson import ObjectId

router = APIRouter()


@router.get("/store/{store_id}", response_model=List[dict])
def get_inventory_for_store(store_id: str, current_user: str = Depends(get_current_user)):
    """Return inventory items for a given store (only if user owns the store)."""
    store = get_store_by_id(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    # Verify ownership
    if str(store.get("user_id")) != str(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")

    items = get_inventory_by_store(store_id)
    # Enrich with basic product info (sku, name) when possible
    for item in items:
        pid = item.get("product_id")
        if pid and ObjectId.is_valid(pid):
            prod = products_collection.find_one({"_id": ObjectId(pid)})
            if prod:
                item["product_sku"] = prod.get("sku")
                item["product_name"] = prod.get("name")
    return items


@router.get("/low-stock/{store_id}", response_model=List[dict])
def get_low_stock_for_store(store_id: str, current_user: str = Depends(get_current_user)):
    """Return low-stock inventory for a store (ownership checked)."""
    store = get_store_by_id(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if str(store.get("user_id")) != str(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")

    items = get_low_stock(store_id)
    for item in items:
        pid = item.get("product_id")
        if pid and ObjectId.is_valid(pid):
            prod = products_collection.find_one({"_id": ObjectId(pid)})
            if prod:
                item["product_sku"] = prod.get("sku")
                item["product_name"] = prod.get("name")
    return items
