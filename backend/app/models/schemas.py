from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProductBase(BaseModel):
    sku: str
    name: str
    category: str
    price: float
    cost: float


class ProductCreate(ProductBase):
    pass


class Product(ProductBase):
    id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SalesRecord(BaseModel):
    date: datetime
    sku: str
    quantity: int
    price: float
    revenue: float
    promo: bool = False

    class Config:
        from_attributes = True


class HealthCheck(BaseModel):
    status: str
    database: str
