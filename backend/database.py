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
products_collection = db["products"]
sales_collection = db["sales"]
inventory_collection = db["inventory"]
forecasts_collection = db["forecasts"]

def get_database():
    """Return database instance"""
    return db

def get_collection(collection_name: str):
    """Get a specific collection"""
    return db[collection_name]
