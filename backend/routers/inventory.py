from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from typing import List

import pandas as pd
from dal.inventory_repo import (
    get_inventory_by_store,
    get_low_stock,
    calculate_safety_stock,
    calculate_reorder_point,
    calculate_eoq,
    perform_abc_analysis,
    get_stock_status,
)
from dal.stores_repo import get_store_by_id
from dal.sales_repo import get_sales_by_product
from database import products_collection, inventory_collection
from models import InventoryItem, InventoryOptimizationResponse
from utils.auth import get_current_user
from bson import ObjectId

router = APIRouter()


@router.get("/store/{store_id}")
def get_inventory_for_store(
    store_id: str,
    skip: int = 0,
    limit: int = 100,
    current_user: str = Depends(get_current_user),
):
    """Return paginated inventory items for a given store (ownership checked).

    Returns JSON: { items: [...], total: <count> }
    """
    store = get_store_by_id(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    # Verify ownership
    if str(store.get("user_id")) != str(current_user):
        raise HTTPException(status_code=403, detail="Forbidden")

    items = get_inventory_by_store(store_id, skip=skip, limit=limit)
    # Enrich with basic product info (sku, name) when possible
    for item in items:
        pid = item.get("product_id")
        if pid and ObjectId.is_valid(pid):
            prod = products_collection.find_one({"_id": ObjectId(pid)})
            if prod:
                item["product_sku"] = prod.get("sku")
                item["product_name"] = prod.get("name")

    total = int(inventory_collection.count_documents({"store_id": store_id}))
    return {"items": items, "total": total}

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
        # Use real inventory from DB
        store = get_store_by_id(store_id)
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")

        inventory_items = get_inventory_by_store(store_id)
        if not inventory_items:
            raise HTTPException(status_code=404, detail=f"No inventory found for store {store_id}")

        metrics_list = []
        # simple default unit cost by category if product has no price
        unit_costs = {
            "Electronics": 100,
            "Clothing": 30,
            "Food": 5,
        }

        for item in inventory_items:
            prod_id = item.get("product_id")
            # Resolve product metadata if available
            product_name = item.get("product_name")
            category = item.get("category") or "Uncategorized"
            current_stock = int(item.get("quantity", 0) or 0)

            # Attempt to get product doc for category/price
            try:
                if prod_id and ObjectId.is_valid(prod_id):
                    prod_doc = products_collection.find_one({"_id": ObjectId(prod_id)})
                    if prod_doc:
                        product_name = prod_doc.get("name") or product_name
                        category = prod_doc.get("category") or category
                        unit_cost = prod_doc.get("cost") or unit_costs.get(category, 10)
                    else:
                        unit_cost = unit_costs.get(category, 10)
                else:
                    unit_cost = unit_costs.get(category, 10)
            except Exception:
                unit_cost = unit_costs.get(category, 10)

            # Get sales for this product (filter by store)
            sales = []
            if prod_id:
                try:
                    sales = get_sales_by_product(prod_id)
                    # filter by store_id (string compare)
                    sales = [s for s in sales if str(s.get("store_id")) == str(store_id)]
                except Exception:
                    sales = []

            # Build dataframe of sales (date, quantity)
            if sales:
                df = pd.DataFrame([{
                    "date": s.get("sale_date") or s.get("created_at"),
                    "quantity": s.get("quantity", 0)
                } for s in sales])
                # ensure datetime
                df["date"] = pd.to_datetime(df["date"])
                if df.empty:
                    continue

                avg_daily_demand = df["quantity"].mean()
                demand_std = df["quantity"].std()
                if pd.isna(demand_std) or demand_std < 1:
                    demand_std = max(1.0, avg_daily_demand * 0.2)

                days_of_data = (df["date"].max() - df["date"].min()).days + 1
                total_demand = df["quantity"].sum()
                annual_demand = (total_demand / max(1, days_of_data)) * 365
            else:
                # No sales history: set conservative defaults
                avg_daily_demand = 0.0
                demand_std = 0.0
                annual_demand = 0.0

            safety_stock = calculate_safety_stock(avg_daily_demand, demand_std or (avg_daily_demand * 0.2), lead_time_days, service_level)
            reorder_point = calculate_reorder_point(avg_daily_demand, lead_time_days, safety_stock)
            eoq = calculate_eoq(annual_demand, unit_cost=unit_cost)
            unit_price = unit_cost * 1.5
            annual_revenue = annual_demand * unit_price
            stock_days = (current_stock / avg_daily_demand) if avg_daily_demand > 0 else 999

            metrics_list.append({
                "product": product_name or str(prod_id),
                "category": category,
                "current_stock": current_stock,
                "avg_daily_demand": round(avg_daily_demand, 2),
                "demand_std": round(demand_std, 2),
                "reorder_point": int(reorder_point),
                "safety_stock": int(safety_stock),
                "recommended_order_qty": int(eoq),
                "annual_revenue": round(annual_revenue, 2),
                "stock_days": round(stock_days if isinstance(stock_days, (int, float)) else 0, 1),
                "abc_classification": "",
                "status": "",
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
