from models import HealthCheck
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pymongo import MongoClient
from utils import create_indexes
import os

# Load environment variables
load_dotenv()

# Create FastAPI app with redirect_slashes=False to prevent POST redirects
app = FastAPI(
    title="Retail Forecasting & Inventory API",
    description="Backend API for retail forecasting and inventory management",
    version="1.0.0",
)

# Force reload

# Configure CORS - Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Retail Forecasting & Inventory API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/api/health", response_model=HealthCheck, tags=["health"])
def health_check():
    """Health check endpoint. Verifies API and MongoDB connection."""
    try:
        mongo_uri = os.getenv("MONGO_URI", "mongodb://admin:password@localhost:27017/?authSource=admin")
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        # Ping the database
        client.admin.command("ping")
        db_status = "connected"
    except Exception as e:
        db_status = f"disconnected: {str(e)}"

    return HealthCheck(status="ok", database=db_status)

# Import routers
from routers import auth, products,stores,sales,forecasting,inventory,purchase_orders
from services.chat import router as chat_router
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(chat_router, prefix="/api")
app.include_router(stores.router, prefix="/api/stores", tags=["Stores"])
app.include_router(sales.router, prefix="/api/sales", tags=["Sales"])
app.include_router(forecasting.router, prefix="/api/forecasting", tags=["Forecasting"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["Inventory"])
#varianta flavia-> app.include_router(inventory.router, prefix="/api/data/inventory", tags=["Inventory"])
app.include_router(purchase_orders.router, prefix="/api/purchase-orders", tags=["Purchase Orders"])

@app.on_event("startup")
def startup_event():
    """Create required indexes on startup."""
    create_indexes()

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host=host, port=port, reload=True)
