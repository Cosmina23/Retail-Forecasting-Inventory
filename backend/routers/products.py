from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from datetime import datetime
from models import Product
from database import products_collection
from utils.auth import get_current_user
from bson import ObjectId

router = APIRouter()

@router.get("/", response_model=List[dict])
async def get_products(current_user: str = Depends(get_current_user)):
    """Get all products"""
    products = []
    for product in products_collection.find():
        product["id"] = str(product.pop("_id"))
        products.append(product)
    return products

@router.get("/{product_id}", response_model=dict)
async def get_product(product_id: str, current_user: str = Depends(get_current_user)):
    """Get a specific product"""
    product = products_collection.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    product["id"] = str(product.pop("_id"))
    return product

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_product(product: Product, current_user: str = Depends(get_current_user)):
    """Create a new product"""
    product_dict = product.dict(exclude={"id"})
    product_dict["created_at"] = datetime.utcnow()
    
    result = products_collection.insert_one(product_dict)
    product_dict["id"] = str(result.inserted_id)
    
    return product_dict

@router.put("/{product_id}", response_model=dict)
async def update_product(product_id: str, product: Product, current_user: str = Depends(get_current_user)):
    """Update a product"""
    product_dict = product.dict(exclude={"id", "created_at"})
    
    result = products_collection.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": product_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    updated_product = products_collection.find_one({"_id": ObjectId(product_id)})
    updated_product["id"] = str(updated_product.pop("_id"))
    return updated_product

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: str, current_user: str = Depends(get_current_user)):
    """Delete a product"""
    result = products_collection.delete_one({"_id": ObjectId(product_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    return None
