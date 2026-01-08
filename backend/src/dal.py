## Data Access Layer->handles all interactions between application and the database, and database operations

from collections.abc import Sequence
from bson import ObjectId
from motor.motor_Asyncio import AsyncIOMotorCollection
from pymongo import ReturnDocument
from pydantic import BaseModel, Field
from database import products_collection,users_collection
from uuid import uuid4
from app.models.schemas import UserCreate,User,Product,ProductCreate,Sale

from utils.auth import get_password_hash, verify_password
from datetime import datetime

class RetailDal:
    def __init__(self,retail_collection: AsyncIOMotorCollection):
        self._retail_collection=retail_collection

    #user
    async def create_user(user:UserCreate)->User:
        user_doc={
            "email":user.email,
            "full_name": user.full_name,
            "hashed_password": get_password_hash(user.password),
            "created_at": datetime.utcnow(),
            "is_active": True
        }
        result = await users_collection.insert_one(user_doc)
        user_doc["id"] = str(result.inserted_id)
        return User(**user_doc)
    
    # products
    async def insert_products(docs:Sequence[dict]):
        if not docs:
            return {"inserted_count":0}
        result=await products_collection.insert_many(docs)
        return{"inserted_count":len(result.inserted_ids)}
    
