from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: str
    created_at: datetime
    is_active: bool = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class Product(BaseModel):
    id: Optional[str] = None
    name: str
    sku: str
    category: Optional[str] = None
    price: float
    current_stock: int = 0
    created_at: Optional[datetime] = None

class Sale(BaseModel):
    id: Optional[str] = None
    product_id: str
    quantity: int
    total_amount: float
    sale_date: datetime
    shop_id: Optional[str] = None

class InventoryItem(BaseModel):
    id: Optional[str] = None
    product_id: str
    shop_id: str
    quantity: int
    last_updated: datetime
    reorder_level: int = 10
    reorder_quantity: int = 50

class ForecastRequest(BaseModel):
    product_id: str
    days: int = 30
    shop_id: Optional[str] = None

class ForecastResponse(BaseModel):
    product_id: str
    forecast_data: List[dict]
    accuracy_score: Optional[float] = None
    generated_at: datetime

class Store(BaseModel):
    name: str
    status: str = "online"
    revenue: float = 0.0

