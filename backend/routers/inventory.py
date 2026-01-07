from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta

router = APIRouter()


class InventoryMetrics(BaseModel):
    product: str
    category: str
    current_stock: int
    avg_daily_demand: float
    demand_std: float
    reorder_point: int
    safety_stock: int
    recommended_order_qty: int
    abc_classification: str
    annual_revenue: float
    stock_days: float
    status: str


class InventoryOptimizationResponse(BaseModel):
    store_id: str
    total_products: int
    metrics: List[InventoryMetrics]
    abc_summary: Dict[str, int]
    total_annual_revenue: float


def calculate_safety_stock(avg_demand: float, demand_std: float, lead_time_days: int = 7, service_level: float = 0.95) -> int:
    """
    Calculate safety stock using statistical method

    Formula: Safety Stock = Z × σ × √L
    Where:
    - Z = Z-score for service level (0.95 = 1.65, 0.99 = 2.33)
    - σ = standard deviation of demand
    - L = lead time in days
    """
    # Z-scores for common service levels
    z_scores = {
        0.90: 1.28,
        0.95: 1.65,
        0.99: 2.33,
        0.999: 3.09
    }

    z_score = z_scores.get(service_level, 1.65)

    # Safety stock formula
    safety_stock = z_score * demand_std * np.sqrt(lead_time_days)

    return int(np.ceil(safety_stock))


def calculate_reorder_point(avg_demand: float, lead_time_days: int, safety_stock: int) -> int:
    """
    Calculate reorder point

    Formula: ROP = (Average Daily Demand × Lead Time) + Safety Stock
    """
    reorder_point = (avg_demand * lead_time_days) + safety_stock

    return int(np.ceil(reorder_point))


def calculate_eoq(annual_demand: float, ordering_cost: float = 50, holding_cost_rate: float = 0.25, unit_cost: float = 10) -> int:
    """
    Calculate Economic Order Quantity (EOQ)

    Formula: EOQ = √((2 × D × S) / H)
    Where:
    - D = annual demand
    - S = ordering cost per order
    - H = holding cost per unit per year
    """
    if annual_demand <= 0:
        return 0

    holding_cost = unit_cost * holding_cost_rate

    eoq = np.sqrt((2 * annual_demand * ordering_cost) / holding_cost)

    return int(np.ceil(eoq))


def perform_abc_analysis(products_df: pd.DataFrame) -> pd.DataFrame:
    """
    Perform ABC analysis based on annual revenue

    Classification:
    - A items: Top 20% of products contributing to 80% of revenue
    - B items: Next 30% of products contributing to 15% of revenue
    - C items: Remaining 50% of products contributing to 5% of revenue
    """
    # Calculate annual revenue for each product
    products_df = products_df.sort_values('annual_revenue', ascending=False).copy()

    # Calculate cumulative percentage
    total_revenue = products_df['annual_revenue'].sum()
    products_df['revenue_cumsum'] = products_df['annual_revenue'].cumsum()
    products_df['revenue_cumsum_pct'] = (products_df['revenue_cumsum'] / total_revenue) * 100

    # Classify based on cumulative percentage
    def classify(row):
        if row['revenue_cumsum_pct'] <= 80:
            return 'A'
        elif row['revenue_cumsum_pct'] <= 95:
            return 'B'
        else:
            return 'C'

    products_df['abc_classification'] = products_df.apply(classify, axis=1)

    return products_df


def get_stock_status(current_stock: int, reorder_point: int, safety_stock: int) -> str:
    """
    Determine stock status based on current inventory levels
    """
    if current_stock <= safety_stock:
        return "Critical"
    elif current_stock <= reorder_point:
        return "Low - Order Now"
    elif current_stock <= reorder_point * 1.5:
        return "Moderate"
    else:
        return "Healthy"


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
