from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import pandas as pd
import numpy as np
import joblib
import holidays
from pathlib import Path
from datetime import datetime, timedelta
from dal.products_repo import get_product_by_id
from database import db, sales_collection, inventory_collection, products_collection, stores_collection, forecasts_collection
from models import ForecastRequest, ForecastResponse, ProductForecast

router = APIRouter()

# Load model, encoders, and artifacts
MODEL_DIR = Path(__file__).parent.parent / "models"

try:
    model = joblib.load(MODEL_DIR / "lgbm_global_forecasting.pkl")
    encoders = joblib.load(MODEL_DIR / "encoders.pkl")
    artifacts = joblib.load(MODEL_DIR / "model_artifacts.pkl")
    
    features = artifacts["features"]
    categorical_features = artifacts["categorical_features"]
    
    store_id_map = encoders.get("store_id_map", {})
    product_map = encoders.get("product_map", {})
    category_map = encoders.get("category_map", {})
    
    # Reverse maps for decoding
    product_id_to_name = {v: k for k, v in product_map.items()}
    
    print("✅ Model loaded successfully")
    print(f"   - Store ID map contains {len(store_id_map)} stores")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    # Initialize empty maps as fallback
    store_id_map = {}
    product_map = {}
    category_map = {}
    product_id_to_name = {}
    model = None


def create_forecast_features(store_id: str, products_data: pd.DataFrame, forecast_days: int = 7) -> pd.DataFrame:
    """
    Create features for forecasting next N days
    """
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    # Check if store exists in the database
    from bson import ObjectId
    store_id_str = str(store_id)
    
    # Try to find the store in the database
    store_doc = None
    if ObjectId.is_valid(store_id_str):
        store_doc = stores_collection.find_one({"_id": ObjectId(store_id_str)})
    else:
        store_doc = stores_collection.find_one({"store_id": store_id_str})
    
    if not store_doc:
        raise HTTPException(status_code=404, detail=f"Store {store_id} not found in database")
    
    # Use the store_id_map if available for encoding, otherwise use a fallback
    store_code = None
    if store_id_str in store_id_map:
        store_code = store_id_map[store_id_str]
        print(f"✅ Using trained store encoding for store {store_id}: {store_code}")
    else:
        # For new stores not in training data, use a default/fallback encoding
        if store_id_map and len(store_id_map) > 0:
            # Use the first store's code as fallback
            store_code = list(store_id_map.values())[0]
            print(f"⚠️ Store {store_id} not in training data, using fallback encoding: {store_code}")
        else:
            # If store_id_map is empty, use 1 as default
            store_code = 1
            print(f"⚠️ No store encoding available, using default: {store_code}")
    
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
        product_code = None
        if product_name in product_map:
            product_code = product_map[product_name]
            print(f"✅ Using trained product encoding for product {product_name}: {product_code}")
        else:
            # For new products not in training data, use a fallback encoding
            if product_map and len(product_map) > 0:
                # Use the first product's code as fallback
                product_code = list(product_map.values())[0]
                print(f"⚠️ Product {product_name} not in training data, using fallback encoding: {product_code}")
            else:
                # If product_map is empty, use a default value
                product_code = 1
                print(f"⚠️ No product encoding available, using default: {product_code}")
            
        category_code = category_map.get(category)
        if category_code is None:
            # If category not in map, use fallback
            if category_map and len(category_map) > 0:
                category_code = list(category_map.values())[0]
                print(f"⚠️ Category {category} not in training data, using fallback: {category_code}")
            else:
                category_code = 1
        
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
    
    if not forecast_rows:
        raise HTTPException(status_code=400, detail="No forecast data could be generated. Check that products and store exist in the database.")
    
    forecast_df = pd.DataFrame(forecast_rows)
    
    # Ensure date column is datetime type
    if 'date' in forecast_df.columns:
        forecast_df['date'] = pd.to_datetime(forecast_df['date'])
    
    return forecast_df


@router.post("/predict", response_model=ForecastResponse)
async def predict_forecast(request: ForecastRequest):
    """
    Generate forecasts for all products in a store for the next N days
    Loads cached forecast if it's less than 7 days old, otherwise generates a new one
    """
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded. Please check server logs.")
    
    try:
        # Check for cached forecast (less than 7 days old)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        cached_forecast = forecasts_collection.find_one({
            "store_id": request.store_id,
            "forecast_period_days": request.days,
            "forecast_date": {"$gte": seven_days_ago}
        }, sort=[("forecast_date", -1)])  # Get the most recent one
        
        if cached_forecast:
            print(f"✅ Found cached forecast from {cached_forecast['forecast_date']}")
            # Convert cached forecast to response format
            product_forecasts = [
                ProductForecast(**pf) for pf in cached_forecast['products']
            ]
            return ForecastResponse(
                store_id=cached_forecast['store_id'],
                forecast_period=cached_forecast['forecast_period'],
                products=product_forecasts,
                total_revenue_forecast=cached_forecast['total_revenue_forecast']
            )
        
        print(f"📊 No recent forecast found, generating new forecast for store {request.store_id}")
        
        print(f"📊 Fetching data from MongoDB for store {request.store_id}")

        # Read from MongoDB instead of CSV
        sales_cursor = sales_collection.find({"store_id": request.store_id})
        sales_data = list(sales_cursor)

        inventory_cursor = inventory_collection.find({"store_id": request.store_id})
        inventory_data = list(inventory_cursor)

        if not sales_data:
            raise HTTPException(status_code=404, detail=f"No sales data found for store {request.store_id}")
        
        if not inventory_data:
            raise HTTPException(status_code=404, detail=f"No inventory data found for store {request.store_id}")

        print(f"✅ Found {len(sales_data)} sales records and {len(inventory_data)} inventory items")

        # Fetch product names once for efficiency
        products_collection_data = list(products_collection.find({}))
        product_name_map = {p.get('_id'): p.get('name') for p in products_collection_data if p.get('_id') and p.get('name')}
        print(f"✅ Loaded {len(product_name_map)} product names from database")

        # Remove MongoDB _id field and convert to DataFrames
        for doc in sales_data:
            doc.pop('_id', None)
        for doc in inventory_data:
            doc.pop('_id', None)
        
        sales_history = pd.DataFrame(sales_data)
        current_inventory = pd.DataFrame(inventory_data)

        # Parse dates - ensure date column exists and is properly formatted
        # Sales collection uses 'sale_date', not 'date'
        if 'sale_date' in sales_history.columns:
            sales_history['date'] = pd.to_datetime(sales_history['sale_date'])
        elif 'date' in sales_history.columns:
            sales_history['date'] = pd.to_datetime(sales_history['date'])
        else:
            raise HTTPException(status_code=400, detail="Sales data missing 'date' or 'sale_date' column")

        # Ensure we have product information
        # If inventory has product_id but not product name, try to look it up from products collection
        if 'product' not in current_inventory.columns and 'product_id' in current_inventory.columns:
            # Enrich inventory with product names using the pre-fetched map
            current_inventory['product'] = current_inventory['product_id'].map(lambda x: product_name_map.get(x, str(x)))
        
        # Ensure sales also have product names
        if 'product' not in sales_history.columns and 'product_id' in sales_history.columns:
            # Enrich sales with product names using the pre-fetched map
            sales_history['product'] = sales_history['product_id'].map(lambda x: product_name_map.get(x, str(x)))

        # Calculate lag features from history
        products_data = []
        if 'product' not in current_inventory.columns:
            raise HTTPException(status_code=400, detail="Inventory data missing 'product' name information")
        
        for product in current_inventory["product"].unique():
            prod_2=get_product_by_id(product)
            prod_sales = sales_history[sales_history["product"] == product].sort_values("date")
            prod_inv_match = current_inventory[current_inventory["product"] == product]

            if prod_inv_match.empty:
                continue

            prod_inv = prod_inv_match.iloc[0]

            if len(prod_sales) > 0:
                last_sale = prod_sales.iloc[-1]["quantity"]
                last_week_sale = prod_sales.iloc[-7]["quantity"] if len(prod_sales) >= 7 else last_sale
                avg_7day = prod_sales.tail(7)["quantity"].mean()
            else:
                last_sale = 10
                last_week_sale = 10
                avg_7day = 10
            
            # Get category from inventory or sales
            category = prod_2.get("category", "Unknown")
            
            products_data.append({
                "product": product,
                "category": category,
                "current_stock": prod_inv.get("quantity") or prod_inv.get("stock_quantity") or 0,
                "last_sale": last_sale,
                "last_week_sale": last_week_sale,
                "avg_7day": avg_7day,
                "customers": prod_sales["customers"].mean() if len(prod_sales) > 0 and "customers" in prod_sales.columns else 100,
                "competition_distance": sales_history["competition_distance"].iloc[0] if "competition_distance" in sales_history.columns and len(sales_history) > 0 else 999999,
                "promo": 0,
                "promo2": 0
            })
        
        products_df = pd.DataFrame(products_data)
        
        # Generate forecast features
        forecast_df = create_forecast_features(request.store_id, products_df, request.days)
        
        # Ensure date column exists and is properly formatted
        if 'date' not in forecast_df.columns:
            raise HTTPException(status_code=500, detail="Forecast DataFrame missing 'date' column")
        
        # Ensure all required feature columns exist
        missing_features = [f for f in features if f not in forecast_df.columns]
        if missing_features:
            raise HTTPException(status_code=500, detail=f"Forecast DataFrame missing features: {missing_features}")
        
        # Make predictions
        X_forecast = forecast_df[features].astype("float32")
        
        # Debug: Print sample features
        print(f"\n🔍 DEBUG: Forecast DataFrame shape: {forecast_df.shape}")
        if len(forecast_df) > 0:
            print(f"🔍 DEBUG: Sample row (first product, first day):")
            print(forecast_df.iloc[0][["product", "date", "lag_1", "lag_7", "r7", "customers"]])

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
            
            # Convert date objects to ISO format strings for JSON serialization
            try:
                dates = [str(d) if isinstance(d, (pd.Timestamp, datetime)) else str(d) for d in prod_forecast["date"].tolist()]
            except Exception as date_err:
                print(f"⚠️  Error converting dates for product {product}: {date_err}")
                raise HTTPException(status_code=500, detail=f"Error serializing dates: {str(date_err)}")
            
            # Get current stock
            prod_info = products_df[products_df["product"] == product].iloc[0]
            current_stock = int(prod_info["current_stock"])
            category = prod_info["category"]
            
            # Calculate recommended order
            # Order = forecasted demand - current stock (with safety buffer)
            safety_buffer = int(total_forecast * 0.2)  # 20% safety stock
            recommended_order = max(0, int(total_forecast) + safety_buffer - current_stock)
            
            # Estimate revenue (mock prices)
            product_price = prod_info.get("price", 5.0)  # Ia prețul real din DB
            total_revenue += total_forecast * product_price
            
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
        
        forecast_response = ForecastResponse(
            store_id=request.store_id,
            forecast_period=f"{request.days} days",
            products=product_forecasts,
            total_revenue_forecast=round(total_revenue, 2)
        )
        
        # Save forecast to database
        try:
            forecast_doc = {
                "store_id": request.store_id,
                "forecast_date": datetime.utcnow(),
                "forecast_period_days": request.days,
                "forecast_period": f"{request.days} days",
                "products": [
                    {
                        "product": pf.product,
                        "category": pf.category,
                        "daily_forecast": pf.daily_forecast,
                        "total_forecast": pf.total_forecast,
                        "current_stock": pf.current_stock,
                        "recommended_order": pf.recommended_order,
                        "dates": pf.dates
                    }
                    for pf in product_forecasts
                ],
                "total_revenue_forecast": forecast_response.total_revenue_forecast,
                "created_at": datetime.utcnow()
            }
            result = forecasts_collection.insert_one(forecast_doc)
            print(f"✅ Forecast saved to database with ID: {result.inserted_id}")
        except Exception as save_err:
            print(f"⚠️ Warning: Could not save forecast to database: {save_err}")
            # Don't fail the request if saving fails, just log the warning
        
        return forecast_response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Forecasting error: {str(e)}")
        import traceback
        traceback.print_exc()
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
