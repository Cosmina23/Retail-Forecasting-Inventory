"""
User Service - Business Logic Layer
Handles user-related business logic (registration, login, etc.)
"""

from fastapi import HTTPException, status
from datetime import timedelta
from typing import Dict, Any

from models import UserCreate, UserLogin
from dal.users_repo import create_user, get_user_by_email
from utils.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)


async def register_user(user_data: UserCreate) -> Dict[str, Any]:
    """
    Register a new user.
    
    Args:
        user_data: UserCreate schema with email, full_name, password
        
    Returns:
        Dictionary with access_token and token_type
        
    Raises:
        HTTPException: If email already exists
    """
    # Check if user already exists
    existing_user = get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)

    # Create user in database
    user_doc = await create_user(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hashed_password
    )

    # Create a store for the user
    from dal.stores_repo import create_store
    store_name = user_data.full_name + "'s Store" if user_data.full_name else user_data.email + "'s Store"
    market = user_data.market or "default"
    store_doc = create_store(
        name=store_name,
        user_id=user_doc["id"],
        market=market
    )

    # Generate access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        user_id=user_doc["id"],
        expires_delta=access_token_expires
    )

    return {
        "message": "User and store created successfully",
        "access_token": access_token,
        "token_type": "bearer",
        "store_id": store_doc["id"],
        "store": store_doc
    }


def login_user(login_data: UserLogin) -> Dict[str, str]:
    """
    Authenticate and login a user.
    
    Args:
        login_data: UserLogin schema with email and password
        
    Returns:
        Dictionary with access_token and token_type
        
    Raises:
        HTTPException: If credentials are invalid
    """
    # Find user
    user = get_user_by_email(login_data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Verify password
    if not verify_password(login_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Generate access token with user_id
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        user_id=user["id"],
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
