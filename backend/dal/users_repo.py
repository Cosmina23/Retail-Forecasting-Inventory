"""
Users Repository - Data Access Layer
Handles all database operations for users collection.
"""

from database import users_collection
from typing import Optional, Dict, Any
from datetime import datetime
from bson import ObjectId


async def create_user(email: str, full_name: Optional[str], hashed_password: str) -> Dict[str, Any]:
    """
    Create a new user in the database.
    
    Args:
        email: User's email address
        full_name: User's full name (optional)
        hashed_password: Already hashed password
        
    Returns:
        Dictionary with user data including the new user_id
    """
    user_doc = {
        "email": email,
        "full_name": full_name,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow(),
        "is_active": True
    }
    
    result = users_collection.insert_one(user_doc)
    user_doc["id"] = str(result.inserted_id)
    
    return user_doc


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Get a user by email address.
    
    Args:
        email: User's email address
        
    Returns:
        User document or None if not found
    """
    user = users_collection.find_one({"email": email})
    if user:
        user["id"] = str(user.get("_id", ""))
    return user


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a user by ID.
    
    Args:
        user_id: User's ID
        
    Returns:
        User document or None if not found
    """
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if user:
        user["id"] = str(user.get("_id", ""))
    return user


def update_user(user_id: str, updates: Dict[str, Any]) -> bool:
    """
    Update a user's information.
    
    Args:
        user_id: User's ID
        updates: Dictionary of fields to update
        
    Returns:
        True if updated, False if not found
    """
    result = users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": updates}
    )
    return result.matched_count > 0
