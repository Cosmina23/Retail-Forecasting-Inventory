import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from database import (
    sales_collection,
    activity_logs_collection,
    stores_collection,
    products_collection,
    forecasts_collection
)
import random
from bson import ObjectId

def populate_sample_data():
    # Get first store or create one
    store = stores_collection.find_one()
    if not store:
        store_id = stores_collection.insert_one({
            "name": "Demo Store",
            "address": "123 Main St",
            "created_at": datetime.utcnow()
        }).inserted_id
        store_id = str(store_id)
        print(f"Created store: {store_id}")
    else:
        store_id = str(store["_id"])
        print(f"Using existing store: {store_id}")

    # Sample products
    products = ["Widget A", "Widget B", "Gadget X", "Tool Y", "Part Z"]
    product_ids = []

    for name in products:
        existing = products_collection.find_one({"name": name, "store_id": store_id})
        if existing:
            product_ids.append(str(existing["_id"]))
        else:
            pid = products_collection.insert_one({
                "name": name,
                "store_id": store_id,
                "sku": f"SKU-{name.replace(' ', '-')}",
                "price": random.uniform(10, 100),
                "cost": random.uniform(5, 50),
                "quantity": random.randint(50, 500),
                "created_at": datetime.utcnow()
            }).inserted_id
            product_ids.append(str(pid))

    print(f"Products ready: {len(product_ids)}")

    # Generate sales data for last 6 months
    print("Generating sales data...")
    sales_data = []
    base_date = datetime.utcnow()

    for days_ago in range(180):
        date = base_date - timedelta(days=days_ago)
        num_sales = random.randint(3, 15)

        for _ in range(num_sales):
            product_id = random.choice(product_ids)
            quantity = random.randint(1, 10)
            unit_price = random.uniform(15, 120)

            sales_data.append({
                "store_id": store_id,
                "product_id": product_id,
                "quantity": quantity,
                "unit_price": unit_price,
                "total": quantity * unit_price,
                "date": date,
                "created_at": date
            })

    if sales_data:
        sales_collection.insert_many(sales_data)
        print(f"Inserted {len(sales_data)} sales records")

    # Generate activity logs
    print("Generating activity logs...")
    activity_types = [
        ("forecast_created", "Generated demand forecast", {"products": 5, "days_ahead": 30, "accuracy": 94.5}),
        ("purchase_order_created", "Created purchase order #PO-001", {"items": 3, "total_value": 1500.00}),
        ("inventory_optimized", "Optimized inventory levels", {"products_adjusted": 12, "savings_estimate": 2340.00}),
        ("inventory_updated", "Updated stock quantities", {"products_updated": 8}),
        ("product_added", "Added new product to catalog", {"product_name": "New Widget", "initial_stock": 100}),
        ("sale_recorded", "Recorded bulk sale", {"items": 5, "total": 450.00}),
        ("data_imported", "Imported sales data from CSV", {"records": 150, "file": "sales_2024.csv"}),
        ("settings_updated", "Updated store settings", {"changes": ["tax_rate", "currency"]}),
    ]

    activity_logs = []
    for days_ago in range(30):
        date = base_date - timedelta(days=days_ago, hours=random.randint(0, 23))
        num_activities = random.randint(1, 4)

        for _ in range(num_activities):
            action_type, desc, details = random.choice(activity_types)
            activity_logs.append({
                "store_id": store_id,
                "user_id": "demo_user",
                "action_type": action_type,
                "description": desc,
                "details": details,
                "metadata": {"browser": "Demo Script"},
                "created_at": date
            })

    if activity_logs:
        activity_logs_collection.insert_many(activity_logs)
        print(f"Inserted {len(activity_logs)} activity logs")

    # Generate forecast data
    print("Generating forecast data...")
    for product_id in product_ids[:3]:
        forecast_data = []
        for days_ahead in range(30):
            forecast_date = base_date + timedelta(days=days_ahead)
            forecast_data.append({
                "date": forecast_date.strftime("%Y-%m-%d"),
                "predicted_demand": random.randint(5, 50),
                "lower_bound": random.randint(2, 20),
                "upper_bound": random.randint(30, 70)
            })

        forecasts_collection.insert_one({
            "store_id": store_id,
            "product_id": product_id,
            "forecast_data": forecast_data,
            "created_at": datetime.utcnow(),
            "model_type": "prophet",
            "accuracy": random.uniform(85, 98)
        })

    print("Forecast data generated")
    print(f"\n✅ Sample data populated for store: {store_id}")
    print("You can now test the History page!")

if __name__ == "__main__":
    populate_sample_data()