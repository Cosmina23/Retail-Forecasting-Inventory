from fastapi import APIRouter, HTTPException, status, Depends, File, UploadFile
from typing import List, Optional
from datetime import datetime
from models import Product
from database import products_collection, inventory_collection
from utils.auth import get_current_user
from bson import ObjectId
from pydantic import BaseModel

try:
    import cv2
    import numpy as np
    from pyzbar.pyzbar import decode
    BARCODE_SCANNING_AVAILABLE = True
except ImportError:
    BARCODE_SCANNING_AVAILABLE = False
    print("Warning: opencv-python or pyzbar not installed. Barcode scanning disabled.")
    print("Install with: pip install opencv-python pyzbar")

router = APIRouter()

class ProductWithStores(BaseModel):
    name: str
    sku: str
    barcode: Optional[str] = None
    category: Optional[str] = None
    price: float
    current_stock: int = 0
    manufacturer: Optional[str] = None
    origin_country: Optional[str] = None
    description: Optional[str] = None
    ingredients: Optional[str] = None
    allergens: Optional[str] = None
    image_url: Optional[str] = None
    selectedStores: List[int]

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

@router.post("/extract-barcode")
async def extract_barcode(file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
    """Extract barcode from uploaded image using pyzbar with enhanced detection"""
    if not BARCODE_SCANNING_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Barcode scanning not available. Install opencv-python and pyzbar."
        )
    
    try:
        # Read image file
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid image file"
            )
        
        detected_barcodes = set()
        
        # Try multiple image preprocessing techniques for better detection
        # 1. Original image
        barcodes = decode(image)
        for barcode in barcodes:
            detected_barcodes.add(barcode.data.decode("utf-8"))
        
        # 2. Grayscale conversion
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        barcodes = decode(gray)
        for barcode in barcodes:
            detected_barcodes.add(barcode.data.decode("utf-8"))
        
        # 3. Increase contrast and brightness
        alpha = 1.5  # Contrast control
        beta = 30    # Brightness control
        adjusted = cv2.convertScaleAbs(image, alpha=alpha, beta=beta)
        barcodes = decode(adjusted)
        for barcode in barcodes:
            detected_barcodes.add(barcode.data.decode("utf-8"))
        
        # 4. Adaptive thresholding on grayscale
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        barcodes = decode(thresh)
        for barcode in barcodes:
            detected_barcodes.add(barcode.data.decode("utf-8"))
        
        # 5. Gaussian blur + threshold
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        barcodes = decode(binary)
        for barcode in barcodes:
            detected_barcodes.add(barcode.data.decode("utf-8"))
        
        # 6. Morphological operations to enhance barcode lines
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        morph = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
        barcodes = decode(morph)
        for barcode in barcodes:
            detected_barcodes.add(barcode.data.decode("utf-8"))
        
        # 7. Try inverted image (white barcode on black background)
        inverted = cv2.bitwise_not(gray)
        barcodes = decode(inverted)
        for barcode in barcodes:
            detected_barcodes.add(barcode.data.decode("utf-8"))
        
        return {"barcodes": list(detected_barcodes)}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process image: {str(e)}"
        )

@router.post("/with-stores", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_product_with_stores(
    product_data: ProductWithStores, 
    current_user: str = Depends(get_current_user)
):
    """Create a product and add it to multiple stores' inventory"""
    try:
        # Create product
        product_dict = {
            "name": product_data.name,
            "sku": product_data.sku,
            "barcode": product_data.barcode,
            "category": product_data.category,
            "price": product_data.price,
            "current_stock": product_data.current_stock,
            "manufacturer": product_data.manufacturer,
            "origin_country": product_data.origin_country,
            "description": product_data.description,
            "ingredients": product_data.ingredients,
            "allergens": product_data.allergens,
            "image_url": product_data.image_url,
            "created_at": datetime.utcnow(),
        }
        
        # Check if product with same SKU already exists
        existing = products_collection.find_one({"sku": product_data.sku})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product with SKU '{product_data.sku}' already exists"
            )
        
        # Insert product
        result = products_collection.insert_one(product_dict)
        product_id = str(result.inserted_id)
        product_dict["id"] = product_id
        
        # Add to inventory for each selected store
        inventory_items = []
        for store_id in product_data.selectedStores:
            inventory_item = {
                "product_id": product_id,
                "shop_id": str(store_id),
                "quantity": product_data.current_stock,
                "last_updated": datetime.utcnow(),
                "reorder_level": 10,
                "reorder_quantity": 50,
            }
            inventory_items.append(inventory_item)
        
        if inventory_items:
            inventory_collection.insert_many(inventory_items)
        
        return {
            **product_dict,
            "stores_added": len(product_data.selectedStores)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create product: {str(e)}"
        )
