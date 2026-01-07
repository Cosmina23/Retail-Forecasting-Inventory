import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from datetime import datetime, timedelta
import holidays

# Load model
MODEL_DIR = Path("models")
model = joblib.load(MODEL_DIR / "lgbm_global_forecasting.pkl")
encoders = joblib.load(MODEL_DIR / "encoders.pkl")
artifacts = joblib.load(MODEL_DIR / "model_artifacts.pkl")

features = artifacts["features"]
store_id_map = encoders["store_id_map"]
product_map = encoders["product_map"]
category_map = encoders["category_map"]

print("✅ Model loaded")
print(f"Features: {features}")

# Load mock data
sales_history = pd.read_csv("mock_data/sales_history.csv", parse_dates=["date"])
current_inventory = pd.read_csv("mock_data/current_inventory.csv")

print(f"\n📊 Sales history shape: {sales_history.shape}")
print(f"📊 Inventory shape: {current_inventory.shape}")

# Filter for store 1
store_sales = sales_history[sales_history["store_id"] == 1]
print(f"\n🏪 Store 1 sales: {len(store_sales)} rows")
print(f"Date range: {store_sales['date'].min()} to {store_sales['date'].max()}")

# Get Bread data
bread_sales = store_sales[store_sales["product"] == "Bread"].sort_values("date")
print(f"\n🍞 Bread sales: {len(bread_sales)} days")
print(f"Last 7 days quantities:")
print(bread_sales.tail(7)[["date", "quantity"]])

# Calculate lag features
last_sale = bread_sales.iloc[-1]["quantity"]
last_week_sale = bread_sales.iloc[-7]["quantity"] if len(bread_sales) >= 7 else last_sale
avg_7day = bread_sales.tail(7)["quantity"].mean()

print(f"\n📈 Lag features for Bread:")
print(f"last_sale (lag_1): {last_sale}")
print(f"last_week_sale (lag_7): {last_week_sale}")
print(f"avg_7day (r7): {avg_7day}")

# Create one sample prediction
de_holidays = holidays.Germany()
tomorrow = datetime.now().date() + timedelta(days=1)

sample_row = {
    "store_id_code": store_id_map["1"],
    "product_id_code": product_map["Bread"],
    "category_code": category_map["Food"],
    "day": tomorrow.day,
    "month": tomorrow.month,
    "weekday": tomorrow.weekday(),
    "is_weekend": 1 if tomorrow.weekday() >= 5 else 0,
    "is_holiday": 1 if tomorrow in de_holidays else 0,
    "promo": 0,
    "promo2": 0,
    "lag_1": last_sale,
    "lag_7": last_week_sale,
    "r7": avg_7day,
    "customers": bread_sales["customers"].mean(),
    "competition_distance": store_sales["competition_distance"].iloc[0]
}

print(f"\n🔬 Sample features for Bread on {tomorrow}:")
for key, value in sample_row.items():
    print(f"  {key}: {value}")

# Make prediction
X = pd.DataFrame([sample_row])[features].astype("float32")
print(f"\n🤖 Feature vector shape: {X.shape}")
print(f"Feature vector:\n{X.iloc[0]}")

prediction = model.predict(X, num_iteration=model.best_iteration)
print(f"\n🎯 Prediction: {prediction[0]:.2f} units")
