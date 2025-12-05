from fastapi import APIRouter, HTTPException
from pymongo import MongoClient
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/sales", tags=["sales"])

# Get MongoDB connection
mongo_uri = os.getenv("MONGO_URI", "mongodb://admin:password@localhost:27017/?authSource=admin")
client = MongoClient(mongo_uri)
db = client[os.getenv("MONGO_INITDB_DATABASE", "retail_db")]
sales_collection = db["sales"]
products_collection = db["products"]


@router.get("/")
def get_sales(skip: int = 0, limit: int = 100, days: int = 30):
    """Get recent sales records (last N days by default)."""
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        sales = list(
            sales_collection.find({"date": {"$gte": cutoff_date}})
            .sort("date", -1)
            .skip(skip)
            .limit(limit)
        )
        return {"sales": sales, "count": len(sales)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sku/{sku}")
def get_sales_for_sku(sku: str, days: int = 30):
    """Get sales history for a specific SKU."""
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        sales = list(
            sales_collection.find({"sku": sku, "date": {"$gte": cutoff_date}})
            .sort("date", -1)
        )
        if not sales:
            raise HTTPException(status_code=404, detail="No sales data found for this SKU")
        return {"sku": sku, "sales": sales, "count": len(sales)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
def get_sales_summary(days: int = 30):
    """Get summary statistics for sales in the last N days."""
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        pipeline = [
            {"$match": {"date": {"$gte": cutoff_date}}},
            {
                "$group": {
                    "_id": "$sku",
                    "total_quantity": {"$sum": "$quantity"},
                    "total_revenue": {"$sum": "$revenue"},
                    "avg_price": {"$avg": "$price"},
                }
            },
            {"$sort": {"total_revenue": -1}},
        ]
        summary = list(sales_collection.aggregate(pipeline))
        return {"summary": summary, "period_days": days}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
