import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pymongo import MongoClient

# Utilități și Modele
from models import HealthCheck
from utils import create_indexes
from services.chat import router as chat_router

# Importuri Routere (Grupate și deduplicate)
from routers import (
    auth, 
    products, 
    stores, 
    sales, 
    inventory,
    inventory_grid,
    forecasts, 
    forecasting, 
    purchase_orders, 
    activity, 
    notifications,
    activity_logs,
    holidays
)

# Încărcare variabile de mediu
load_dotenv()

app = FastAPI(
    title="Retail Forecasting & Inventory API",
    description="Backend API for retail forecasting and inventory management",
    version="1.0.0",
)

# --- Middleware ---

app.add_middleware(
    CORSMiddleware,
    # For local testing allow all origins. Set specific origins in production.
    allow_origins=["*"],
    # When using a wildcard origin, credentials must be disabled.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# --- Rute de bază (Core) ---

@app.get("/")
async def root():
    return {
        "message": "Retail Forecasting & Inventory API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/api/health", response_model=HealthCheck, tags=["Health"])
def health_check():
    """Verifică starea API-ului și conexiunea cu MongoDB."""
    try:
        mongo_uri = os.getenv("MONGO_URI", "mongodb://admin:password@localhost:27017/?authSource=admin")
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        db_status = "connected"
    except Exception as e:
        db_status = f"disconnected: {str(e)}"

    return HealthCheck(status="ok", database=db_status)

# --- Includere Routere (Prefixe Consistente) ---

# Notă: Dacă routerul are prefixul definit intern (ex: /sales), folosim doar /api
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(stores.router, prefix="/api/stores", tags=["Stores"])  # Devine /api/stores
app.include_router(sales.router, prefix="/api", tags=["Sales"])    # Devine /api/sales
app.include_router(inventory.router, prefix="/api/inventory", tags=["Inventory"])
app.include_router(inventory_grid.router, prefix="/api/inventory_grid", tags=["Inventory_grid"])
app.include_router(forecasts.router, prefix="/api", tags=["Forecasts"])
app.include_router(forecasting.router, prefix="/api/forecasting", tags=["Forecasting"])
app.include_router(purchase_orders.router, prefix="/api/purchase-orders", tags=["Purchase Orders"])
app.include_router(activity.router, prefix="/api", tags=["Activity"])
app.include_router(notifications.router, prefix="/api", tags=["Notifications"])
app.include_router(holidays.router)
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])
app.include_router(activity_logs.router)

# --- Evenimente Lifecycle ---

@app.on_event("startup")
def startup_event():
    """Creează indecșii necesari în baza de date la pornire."""
    create_indexes()

# --- Entry Point ---

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host=host, port=port, reload=True)