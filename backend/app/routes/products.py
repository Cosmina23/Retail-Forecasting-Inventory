from fastapi import APIRouter, HTTPException
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/products", tags=["products"])

# Get MongoDB connection
mongo_uri = os.getenv("MONGO_URI", "mongodb://admin:password@localhost:27017/?authSource=admin")
client = MongoClient(mongo_uri)
db = client[os.getenv("MONGO_INITDB_DATABASE", "retail_db")]
products_collection = db["products"]


@router.get("/")
def get_products(skip: int = 0, limit: int = 100):
    """Get all products with pagination."""
    try:
        products = list(products_collection.find().skip(skip).limit(limit))
        for p in products:
            p["id"] = str(p.get("_id", ""))
        return {"products": products, "count": len(products)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{sku}")
def get_product_by_sku(sku: str):
    """Get a product by SKU."""
    try:
        product = products_collection.find_one({"sku": sku})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        product["id"] = str(product.get("_id", ""))
        return product
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/category/{category}")
def get_products_by_category(category: str):
    """Get all products in a category."""
    try:
        products = list(products_collection.find({"category": category}))
        for p in products:
            p["id"] = str(p.get("_id", ""))
        return {"products": products, "count": len(products)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
