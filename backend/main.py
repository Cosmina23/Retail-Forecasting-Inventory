from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Retail Forecasting & Inventory API",
    description="Backend API for retail forecasting and inventory management",
    version="1.0.0"
)

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

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Import routers
from routers import auth, products, stores, inventory, sales, forecasts, activity
from services.chat import router as chat_router
from routers import auth, products, forecasting, inventory, purchase_orders
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(chat_router, prefix="/api")
app.include_router(stores.router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(sales.router, prefix="/api")
app.include_router(forecasts.router, prefix="/api")
app.include_router(activity.router, prefix="/api")

# app.include_router(inventory.router, prefix="/api/inventory", tags=["Inventory"])
# app.include_router(forecasting.router, prefix="/api/forecasting", tags=["Forecasting"])
app.include_router(forecasting.router, prefix="/api/forecasting", tags=["Forecasting"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["Inventory"])
app.include_router(purchase_orders.router, prefix="/api/purchase-orders", tags=["Purchase Orders"])

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host=host, port=port, reload=True)
