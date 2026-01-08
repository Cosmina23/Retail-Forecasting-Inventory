from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import pandas as pd
import numpy as np
import joblib
import holidays
from pathlib import Path
from datetime import datetime, timedelta

router = APIRouter()

# Load model, encoders, and artifacts
MODEL_DIR = Path(__file__).parent.parent / "models"

try:
    model = joblib.load(MODEL_DIR / "lgbm_global_forecasting.pkl")
    encoders = joblib.load(MODEL_DIR / "encoders.pkl")
    artifacts = joblib.load(MODEL_DIR / "model_artifacts.pkl")
    
    features = artifacts["features"]
    categorical_features = artifacts["categorical_features"]
    
    store_id_map = encoders["store_id_map"]
    product_map = encoders["product_map"]
    category_map = encoders["category_map"]
    
    # Reverse maps for decoding
    product_id_to_name = {v: k for k, v in product_map.items()}
    
    print("✅ Model loaded successfully")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    model = None


class ForecastRequest(BaseModel):
    store_id: str
    days: int = 7


class ProductForecast(BaseModel):
    product: str
    category: str
    daily_forecast: List[float]
    total_forecast: float
    current_stock: int
    recommended_order: int
    dates: List[str]


class ForecastResponse(BaseModel):
    store_id: str
    forecast_period: str
    products: List[ProductForecast]
    total_revenue_forecast: float


def create_forecast_features(store_id: str, products_data: pd.DataFrame, forecast_days: int = 7) -> pd.DataFrame:
    """
    Create features for forecasting next N days
    """
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    # Check if store exists in training data
    store_id_str = str(store_id)
    if store_id_str not in store_id_map:
        raise HTTPException(status_code=404, detail=f"Store {store_id} not found in training data")
    
    store_code = store_id_map[store_id_str]
    
    # Get German holidays
    de_holidays = holidays.Germany()
    
    # Start from tomorrow
    start_date = datetime.now().date() + timedelta(days=1)
    forecast_dates = [start_date + timedelta(days=i) for i in range(forecast_days)]
    
    forecast_rows = []
    
    for _, prod_row in products_data.iterrows():
        product_name = prod_row["product"]
        category = prod_row["category"]
        
        # Check if product exists in training data
        if product_name not in product_map:
            print(f"⚠️ Product {product_name} not in training data, skipping")
            continue
            
        product_code = product_map[product_name]
        category_code = category_map.get(category, 0)
        
        # Get last known values for lag features
        lag_1 = prod_row.get("last_sale", 10)
        lag_7 = prod_row.get("last_week_sale", 10)
        r7 = prod_row.get("avg_7day", 10)
        
        customers = prod_row.get("customers", 100)
        competition_distance = prod_row.get("competition_distance", 999999)
        promo = prod_row.get("promo", 0)
        promo2 = prod_row.get("promo2", 0)
        
        for date in forecast_dates:
            is_holiday = 1 if date in de_holidays else 0
            is_weekend = 1 if date.weekday() >= 5 else 0
            
            row = {
                "date": date,
                "store_id": store_id,
                "product": product_name,
                "category": category,
                "store_id_code": store_code,
                "product_id_code": product_code,
                "category_code": category_code,
                "day": date.day,
                "month": date.month,
                "weekday": date.weekday(),
                "is_weekend": is_weekend,
                "is_holiday": is_holiday,
                "promo": promo,
                "promo2": promo2,
                "lag_1": lag_1,
                "lag_7": lag_7,
                "r7": r7,
                "customers": customers,
                "competition_distance": competition_distance
            }
            
            forecast_rows.append(row)
            
            # Update lags for next day (using predicted value as feedback)
            # For now, we'll use the average
            lag_1 = r7
    
    forecast_df = pd.DataFrame(forecast_rows)
    return forecast_df


@router.post("/predict", response_model=ForecastResponse)
async def predict_forecast(request: ForecastRequest):
    """
    Generate forecasts for all products in a store for the next N days
    """
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded. Please check server logs.")
    
    try:
        # Load mock data for the store
        MOCK_DATA_DIR = Path(__file__).parent.parent / "mock_data"
        
        # Load sales history to get last known values
        sales_history_path = MOCK_DATA_DIR / "sales_history.csv"
        current_inventory_path = MOCK_DATA_DIR / "current_inventory.csv"
        
        if not sales_history_path.exists() or not current_inventory_path.exists():
            raise HTTPException(status_code=404, detail="Mock data files not found")
        
        sales_history = pd.read_csv(sales_history_path, parse_dates=["date"])
        current_inventory = pd.read_csv(current_inventory_path)
        
        # Filter for the requested store
        store_sales = sales_history[sales_history["store_id"] == int(request.store_id)]
        store_inventory = current_inventory[current_inventory["store_id"] == int(request.store_id)]
        
        if store_sales.empty:
            raise HTTPException(status_code=404, detail=f"No sales data found for store {request.store_id}")
        
        # Calculate lag features from history
        products_data = []
        for product in store_inventory["product"].unique():
            prod_sales = store_sales[store_sales["product"] == product].sort_values("date")
            prod_inv = store_inventory[store_inventory["product"] == product].iloc[0]
            
            if len(prod_sales) > 0:
                last_sale = prod_sales.iloc[-1]["quantity"]
                last_week_sale = prod_sales.iloc[-7]["quantity"] if len(prod_sales) >= 7 else last_sale
                avg_7day = prod_sales.tail(7)["quantity"].mean()
            else:
                last_sale = 10
                last_week_sale = 10
                avg_7day = 10
            
            products_data.append({
                "product": product,
                "category": prod_inv["category"],
                "current_stock": prod_inv["stock_quantity"],
                "last_sale": last_sale,
                "last_week_sale": last_week_sale,
                "avg_7day": avg_7day,
                "customers": prod_sales["customers"].mean() if len(prod_sales) > 0 else 100,
                "competition_distance": store_sales["competition_distance"].iloc[0] if "competition_distance" in store_sales.columns else 999999,
                "promo": 0,
                "promo2": 0
            })
        
        products_df = pd.DataFrame(products_data)
        
        # Generate forecast features
        forecast_df = create_forecast_features(request.store_id, products_df, request.days)
        
        # Make predictions
        X_forecast = forecast_df[features].astype("float32")
        
        # Debug: Print sample features
        print(f"\n🔍 DEBUG: Forecast DataFrame shape: {forecast_df.shape}")
        print(f"🔍 DEBUG: Sample row (first product, first day):")
        if len(forecast_df) > 0:
            print(forecast_df.iloc[0][["product", "date", "lag_1", "lag_7", "r7", "customers"]])
            print(f"🔍 DEBUG: X_forecast sample:")
            print(X_forecast.iloc[0])
        
        predictions = model.predict(X_forecast, num_iteration=model.best_iteration)
        print(f"🔍 DEBUG: Predictions sample: {predictions[:5]}")
        predictions = np.maximum(predictions, 0)  # No negative sales
        
        # Add predictions to dataframe
        forecast_df["predicted_quantity"] = predictions
        
        # Group by product and create response
        product_forecasts = []
        total_revenue = 0
        
        for product in products_df["product"]:
            prod_forecast = forecast_df[forecast_df["product"] == product]
            
            if prod_forecast.empty:
                continue
            
            daily_forecast = prod_forecast["predicted_quantity"].round().astype(int).tolist()
            total_forecast = sum(daily_forecast)
            dates = prod_forecast["date"].astype(str).tolist()
            
            # Get current stock
            prod_info = products_df[products_df["product"] == product].iloc[0]
            current_stock = int(prod_info["current_stock"])
            category = prod_info["category"]
            
            # Calculate recommended order
            # Order = forecasted demand - current stock (with safety buffer)
            safety_buffer = int(total_forecast * 0.2)  # 20% safety stock
            recommended_order = max(0, int(total_forecast) + safety_buffer - current_stock)
            
            # Estimate revenue (mock prices)
            avg_price = 50 if category == "Electronics" else 30 if category == "Clothing" else 5
            total_revenue += total_forecast * avg_price
            
            product_forecasts.append(ProductForecast(
                product=product,
                category=category,
                daily_forecast=daily_forecast,
                total_forecast=round(total_forecast, 2),
                current_stock=current_stock,
                recommended_order=recommended_order,
                dates=dates
            ))
        
        # Sort by recommended order (highest first)
        product_forecasts.sort(key=lambda x: x.recommended_order, reverse=True)
        
        return ForecastResponse(
            store_id=request.store_id,
            forecast_period=f"{request.days} days",
            products=product_forecasts,
            total_revenue_forecast=round(total_revenue, 2)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {str(e)}")


@router.get("/stores")
async def get_available_stores():
    """
    Get list of stores available for forecasting
    """
    try:
        MOCK_DATA_DIR = Path(__file__).parent.parent / "mock_data"
        sales_history_path = MOCK_DATA_DIR / "sales_history.csv"
        
        if not sales_history_path.exists():
            return {"stores": []}
        
        sales_history = pd.read_csv(sales_history_path)
        stores = sales_history["store_id"].unique().tolist()
        
        return {"stores": [{"id": int(s), "name": f"Store {s}"} for s in stores]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
