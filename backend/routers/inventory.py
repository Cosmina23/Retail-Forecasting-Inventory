from fastapi import APIRouter, HTTPException, Query
from database import db
from bson import ObjectId
from typing import List, Optional

router = APIRouter(prefix="/inventory", tags=["inventory"])

inventory_collection = db["inventory"]

@router.get("/")
async def get_inventory(store_id: Optional[str] = Query(None)):
    """Get inventory for a specific store"""
    query = {}
    if store_id:
        query["store_id"] = store_id

    inventory = []
    for item in inventory_collection.find(query):
        item["_id"] = str(item["_id"])
        inventory.append(item)

    return inventory

@router.post("/")
async def add_inventory_item(item: dict):
    """Add a new inventory item"""
    result = inventory_collection.insert_one(item)
    item["_id"] = str(result.inserted_id)
    return item

@router.put("/{item_id}")
async def update_inventory_item(item_id: str, item: dict):
    """Update an inventory item"""
    result = inventory_collection.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": item}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item updated"}

@router.delete("/{item_id}")
async def delete_inventory_item(item_id: str):
    """Delete an inventory item"""
    result = inventory_collection.delete_one({"_id": ObjectId(item_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}
