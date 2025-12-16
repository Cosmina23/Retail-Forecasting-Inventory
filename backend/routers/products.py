from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from typing import List
from datetime import datetime
from pathlib import Path
import tempfile
import os

from models import Product
from database import products_collection
from utils.auth import get_current_user
from bson import ObjectId
from dal.products_repo import insert_products, get_all_products, get_product_by_sku, get_products_by_category
from services.data_importer import import_products_from_excel, import_products_from_csv

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


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_products_endpoint(
    file: UploadFile = File(...),
    current_user: str = Depends(get_current_user)
):
    """
    Import products from an Excel or CSV file.
    
    Accepts .xlsx, .xls, or .csv files with product data.
    Expected columns: name, sku, category, price, current_stock
    """
    # Validate file extension
    filename_lower = file.filename.lower()
    is_excel = filename_lower.endswith((".xlsx", ".xls"))
    is_csv = filename_lower.endswith(".csv")
    
    if not (is_excel or is_csv):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Excel (.xlsx, .xls) and CSV files are supported"
        )
    
    try:
        # Save uploaded file to a temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        print(f"[DEBUG] Saved file to: {tmp_file_path}")
        print(f"[DEBUG] File type: {'CSV' if is_csv else 'Excel'}")
        
        # Parse the file based on type
        if is_csv:
            products_data = import_products_from_csv(tmp_file_path)
            file_type = "CSV"
        else:
            products_data = import_products_from_excel(tmp_file_path, sheet_name="Sheet1")
            file_type = "Excel"
        
        print(f"[DEBUG] Parsed {len(products_data)} products from {file_type}")
        print(f"[DEBUG] Sample data: {products_data[:2] if products_data else 'No data'}")
        
        if not products_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No valid products found in the {file_type} file"
            )
        
        # Insert products into database
        result = insert_products(products_data)
        
        print(f"[DEBUG] Inserted {result['inserted_count']} products")
        
        return {
            "message": f"Successfully imported {result['inserted_count']} products from {file_type}",
            "inserted_count": result['inserted_count'],
            "inserted_ids": result['inserted_ids']
        }
    
    except Exception as e:
        print(f"[ERROR] Import failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error importing products: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if 'tmp_file_path' in locals() and os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)
