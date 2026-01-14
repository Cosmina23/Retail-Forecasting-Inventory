from pymongo import MongoClient
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# MongoDB connection
MONGO_URI = os.getenv("MONGO_URI", "mongodb://admin:password@localhost:27017/?authSource=admin")
DATABASE_NAME = os.getenv("DATABASE_NAME", "retail_db")

# Create MongoDB client
client = MongoClient(MONGO_URI)
db = client[DATABASE_NAME]

# Collections
users_collection = db["users"]
stores_collection = db["stores"]
products_collection = db["products"]
inventory_collection = db["inventory"]
sales_collection = db["sales"]
forecasts_collection = db["forecasts"]
purchase_orders_collection = db["purchase_orders"]
promotions_collection = db["promotions"]
holidays_collection = db["holidays_events"]
import_runs_collection = db["import_runs"]
import_logs_collection = db["import_logs"]
chat_history_collection = db["chat_history"]
activity_logs_collection = db["activity_logs"]

def get_database():
    """Return database instance"""
    return db

def get_collection(collection_name: str):
    """Get a specific collection"""
    return db[collection_name]
