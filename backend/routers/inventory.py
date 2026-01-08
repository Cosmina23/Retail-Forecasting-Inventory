from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from typing import List

import pandas as pd
from dal.inventory_repo import get_inventory_by_store, get_low_stock,calculate_safety_stock,calculate_reorder_point,calculate_eoq,perform_abc_analysis, get_stock_status
from dal.stores_repo import get_store_by_id
from database import products_collection
from models import InventoryItem, InventoryOptimizationResponse
from utils.auth import get_current_user
from bson import ObjectId

router = APIRouter()


@router.get("/store/{store_id}", response_model=List[dict])
def get_inventory_for_store(store_id: str, current_user: str = Depends(get_current_user)):
    """Return inventory items for a given store (only if user owns the store)."""
    store = get_store_by_id(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    # Verify ownership
    if str(store.get("user_id")) != str(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")

    items = get_inventory_by_store(store_id)
    # Enrich with basic product info (sku, name) when possible
    for item in items:
        pid = item.get("product_id")
        if pid and ObjectId.is_valid(pid):
            prod = products_collection.find_one({"_id": ObjectId(pid)})
            if prod:
                item["product_sku"] = prod.get("sku")
                item["product_name"] = prod.get("name")
    return items

@router.get("/low-stock/{store_id}", response_model=List[dict])
def get_low_stock_for_store(store_id: str, current_user: str = Depends(get_current_user)):
    """Return low-stock inventory for a store (ownership checked)."""
    store = get_store_by_id(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if str(store.get("user_id")) != str(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")

    items = get_low_stock(store_id)
    for item in items:
        pid = item.get("product_id")
        if pid and ObjectId.is_valid(pid):
            prod = products_collection.find_one({"_id": ObjectId(pid)})
            if prod:
                item["product_sku"] = prod.get("sku")
                item["product_name"] = prod.get("name")
    return items

@router.get("/optimize/{store_id}", response_model=InventoryOptimizationResponse)
async def optimize_inventory(store_id: str, lead_time_days: int = 7, service_level: float = 0.95):
    """
    Calculate inventory optimization metrics for a store
    
    Parameters:
    - store_id: Store identifier
    - lead_time_days: Lead time for reordering (default: 7 days)
    - service_level: Target service level (default: 0.95 = 95%)
    """
    try:
        # Load mock data
        MOCK_DATA_DIR = Path(__file__).parent.parent / "mock_data"
        
        sales_history_path = MOCK_DATA_DIR / "sales_history.csv"
        current_inventory_path = MOCK_DATA_DIR / "current_inventory.csv"
        
        if not sales_history_path.exists() or not current_inventory_path.exists():
            raise HTTPException(status_code=404, detail="Mock data files not found")
        
        sales_history = pd.read_csv(sales_history_path, parse_dates=["date"])
        current_inventory = pd.read_csv(current_inventory_path)
        
        # Filter for the requested store
        store_sales = sales_history[sales_history["store_id"] == int(store_id)]
        store_inventory = current_inventory[current_inventory["store_id"] == int(store_id)]
        
        if store_sales.empty:
            raise HTTPException(status_code=404, detail=f"No data found for store {store_id}")
        
        # Calculate metrics for each product
        metrics_list = []
        
        # Define unit costs by category (for EOQ calculation)
        unit_costs = {
            "Electronics": 100,
            "Clothing": 30,
            "Food": 5
        }
        
        for _, inv_row in store_inventory.iterrows():
            product = inv_row["product"]
            category = inv_row["category"]
            current_stock = inv_row["stock_quantity"]
            
            # Get sales history for this product
            product_sales = store_sales[store_sales["product"] == product]
            
            if len(product_sales) == 0:
                continue
            
            # Calculate demand statistics
            avg_daily_demand = product_sales["quantity"].mean()
            demand_std = product_sales["quantity"].std()
            
            # Handle zero or very low std
            if demand_std < 1:
                demand_std = avg_daily_demand * 0.2  # Assume 20% variability
            
            # Calculate annual demand (extrapolate from available data)
            days_of_data = (product_sales["date"].max() - product_sales["date"].min()).days + 1
            total_demand = product_sales["quantity"].sum()
            annual_demand = (total_demand / days_of_data) * 365
            
            # Calculate safety stock
            safety_stock = calculate_safety_stock(
                avg_daily_demand, 
                demand_std, 
                lead_time_days, 
                service_level
            )
            
            # Calculate reorder point
            reorder_point = calculate_reorder_point(
                avg_daily_demand, 
                lead_time_days, 
                safety_stock
            )
            
            # Calculate EOQ
            unit_cost = unit_costs.get(category, 10)
            eoq = calculate_eoq(annual_demand, unit_cost=unit_cost)
            
            # Calculate annual revenue (quantity × price)
            unit_price = unit_cost * 1.5  # Assume 50% markup
            annual_revenue = annual_demand * unit_price
            
            # Calculate days of stock remaining
            stock_days = current_stock / avg_daily_demand if avg_daily_demand > 0 else 999
            
            metrics_list.append({
                "product": product,
                "category": category,
                "current_stock": current_stock,
                "avg_daily_demand": round(avg_daily_demand, 2),
                "demand_std": round(demand_std, 2),
                "reorder_point": reorder_point,
                "safety_stock": safety_stock,
                "recommended_order_qty": eoq,
                "annual_revenue": round(annual_revenue, 2),
                "stock_days": round(stock_days, 1),
                "abc_classification": "",  # Will be filled by ABC analysis
                "status": ""  # Will be filled after calculating all metrics
            })
        
        # Create DataFrame for ABC analysis
        metrics_df = pd.DataFrame(metrics_list)
        
        # Perform ABC analysis
        metrics_df = perform_abc_analysis(metrics_df)
        
        # Add stock status
        metrics_df['status'] = metrics_df.apply(
            lambda row: get_stock_status(
                row['current_stock'], 
                row['reorder_point'], 
                row['safety_stock']
            ), 
            axis=1
        )
        
        # Convert back to list of dicts
        metrics_list = metrics_df.to_dict('records')
        
        # Calculate ABC summary
        abc_summary = {
            "A": int(metrics_df[metrics_df['abc_classification'] == 'A'].shape[0]),
            "B": int(metrics_df[metrics_df['abc_classification'] == 'B'].shape[0]),
            "C": int(metrics_df[metrics_df['abc_classification'] == 'C'].shape[0])
        }
        
        total_annual_revenue = float(metrics_df['annual_revenue'].sum())
        
        return InventoryOptimizationResponse(
            store_id=store_id,
            total_products=len(metrics_list),
            metrics=metrics_list,
            abc_summary=abc_summary,
            total_annual_revenue=total_annual_revenue
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization error: {str(e)}")

@router.get("/stores")
async def get_stores_for_inventory():
    """
    Get list of stores available for inventory optimization
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
