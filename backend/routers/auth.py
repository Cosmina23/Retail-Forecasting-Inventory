from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta

from models import UserCreate, UserLogin, Token
from services.user_service import register_user, login_user
from dal.users_repo import get_user_by_email
from utils.auth import (
    verify_password,
    create_access_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter()

@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate):
    """Register a new user"""
    return await register_user(user)

@router.post("/login", response_model=Token)
async def login(user: UserLogin):
    """Login user"""
    return login_user(user)

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """OAuth2 compatible token login (for Swagger UI)"""
    user = get_user_by_email(form_data.username)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        user_id=user["id"], expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=dict)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    from dal.users_repo import get_user_by_id
    user = get_user_by_id(current_user)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return {
        "id": str(user["id"]),
        "email": user["email"],
        "full_name": user.get("full_name"),
        "created_at": user["created_at"],
        "is_active": user["is_active"]
    }
