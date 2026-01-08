from datetime import datetime
from typing import Optional, List, Literal

from pydantic import BaseModel, EmailStr


# Users
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    market: Optional[str] = None  # Region/market the user operates in


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(UserBase):
    id: str
    created_at: datetime
    is_active: bool = True
    stores: List[str] = []  # Store IDs owned/managed by the user


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


# Stores
class Store(BaseModel):
    id: Optional[str] = None
    name: str
    user_id: str  # Owner/manager
    market: str
    address: Optional[str] = None
    created_at: Optional[datetime] = None
    is_active: bool = True


class StoreCreate(BaseModel):
    name: str
    market: str
    address: Optional[str] = None


# Products
class Product(BaseModel):
    id: Optional[str] = None
    name: str
    sku: Optional[str] = None
    category: Optional[str] = None
    price: float
    cost: Optional[float] = None
    user_id: Optional[str] = None  # Owner
    store_ids: List[str] = []  # Stores carrying this product
    abc_classification: Optional[Literal["A", "B", "C"]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProductCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    category: Optional[str] = None
    price: float
    cost: Optional[float] = None
    store_ids: List[str] = []


# Inventory
class InventoryItem(BaseModel):
    id: Optional[str] = None
    product_id: str
    store_id: str
    quantity: int
    reserved_quantity: int = 0
    available_quantity: Optional[int] = None
    reorder_point: int = 0
    reorder_quantity: int = 0
    safety_stock: int = 0
    holding_cost_per_unit: Optional[float] = None
    stockout_penalty: Optional[float] = None
    last_updated: datetime
    last_counted: Optional[datetime] = None


# Sales
class Sale(BaseModel):
    id: Optional[str] = None
    product_id: str
    store_id: str
    quantity: int
    total_amount: float
    unit_price: Optional[float] = None
    sale_date: datetime
    day_of_week: Optional[str] = None
    is_weekend: Optional[bool] = None
    is_holiday: Optional[bool] = None
    holiday_name: Optional[str] = None
    promotion_id: Optional[str] = None
    created_at: Optional[datetime] = None


# Forecasts
class ForecastRequest(BaseModel):
    product_id: str
    days: int = 30
    store_id: Optional[str] = None


class ForecastResponse(BaseModel):
    product_id: str
    store_id: Optional[str] = None
    forecast_data: List[dict]
    accuracy_score: Optional[float] = None
    generated_at: datetime


# Purchase Orders (simplified)
class PurchaseOrderItem(BaseModel):
    product_id: str
    sku: Optional[str] = None
    product_name: str
    quantity_ordered: int
    unit_cost: float
    total_cost: float


class PurchaseOrder(BaseModel):
    id: Optional[str] = None
    po_number: str
    store_id: str
    supplier_name: str
    status: Literal["draft", "sent", "confirmed", "received", "cancelled"]
    order_date: datetime
    expected_delivery_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None
    items: List[PurchaseOrderItem]
    total_cost: float
    currency: str = "EUR"
    notes: Optional[str] = None
    created_by: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# Promotions
class Promotion(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    promotion_type: Literal["discount", "bogo", "bundle", "other"]
    store_ids: List[str] = []
    product_ids: List[str] = []
    discount_percentage: Optional[float] = None
    start_date: datetime
    end_date: datetime
    is_active: bool = True
    created_at: Optional[datetime] = None


# Holidays/Events
class Holiday(BaseModel):
    id: Optional[str] = None
    name: str
    event_type: Literal["public_holiday", "shopping_event", "seasonal"]
    date: datetime
    market: str
    impact_level: Literal["high", "medium", "low"]
    typical_demand_change: Optional[float] = None
    affected_categories: List[str] = []
    created_at: Optional[datetime] = None


# Import runs/logs for auditability
class ImportRun(BaseModel):
    id: Optional[str] = None
    run_id: str
    source: str
    collections: List[str]
    status: Literal["running", "success", "failed"]
    started_at: datetime
    finished_at: Optional[datetime] = None
    stats: Optional[dict] = None  # e.g., {"products": {"inserted": 10, "failed": 1}}
    error: Optional[str] = None
    notes: Optional[str] = None


class ImportLog(BaseModel):
    id: Optional[str] = None
    run_id: str
    level: Literal["info", "warn", "error"]
    collection: Optional[str] = None
    record_ref: Optional[dict] = None  # e.g., {"sku": "ABC-123"}
    message: str
    timestamp: datetime


class HealthCheck(BaseModel):
    status: str
    database: str
