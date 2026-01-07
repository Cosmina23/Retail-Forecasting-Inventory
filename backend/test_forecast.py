import requests
import json

# Test forecasting endpoint
url = "http://localhost:8000/api/forecasting/predict"
data = {
    "store_id": "1",
    "days": 7
}

print("Testing forecasting API...")
print(f"POST {url}")
print(f"Data: {data}\n")

try:
    response = requests.post(url, json=data)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"\nStore: {result['store_id']}")
        print(f"Forecast period: {result['forecast_period']}")
        print(f"Total revenue forecast: ${result['total_revenue_forecast']}")
        print(f"\nProducts ({len(result['products'])}):")
        print("-" * 80)
        
        for prod in result['products'][:5]:  # First 5 products
            print(f"\n{prod['product']} ({prod['category']})")
            print(f"  Current stock: {prod['current_stock']}")
            print(f"  7-day forecast: {prod['total_forecast']}")
            print(f"  Daily: {prod['daily_forecast']}")
            print(f"  Recommended order: {prod['recommended_order']}")
    else:
        print(f"Error: {response.text}")
        
except Exception as e:
    print(f"Request failed: {e}")
