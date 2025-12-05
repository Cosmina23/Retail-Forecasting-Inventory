"""
FastAPI application for Retail Forecasting & Inventory Optimizer.

Main entry point. Start with:
  uvicorn main:app --reload --port 8000

Or with explicit host:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import os
from dotenv import load_dotenv

from app.routes import products, sales
from app.models.schemas import HealthCheck

load_dotenv()

app = FastAPI(
    title="Retail Forecasting & Inventory Optimizer API",
    description="API for demand forecasting, inventory optimization, and sales analysis",
    version="0.1.0",
)

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(products.router)
app.include_router(sales.router)


@app.get("/", tags=["root"])
def read_root():
    """Root endpoint."""
    return {
        "message": "Retail Forecasting & Inventory Optimizer API",
        "docs": "/docs",
        "openapi": "/openapi.json",
    }


@app.get("/health", response_model=HealthCheck, tags=["health"])
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
