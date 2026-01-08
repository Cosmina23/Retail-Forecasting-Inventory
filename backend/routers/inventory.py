from pathlib import Path
from datetime import datetime, timedelta
from database import db, sales_collection, inventory_collection
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
    Now reads from MongoDB instead of CSV files
    """
    try:
        # Read from MongoDB instead of CSV
        print(f"📊 Fetching data from MongoDB for store {store_id}")

        # Get sales history from MongoDB
        store_sales_cursor = sales_collection.find({"store_id": store_id})
        sales_data = list(store_sales_cursor)

        # Get current inventory from MongoDB
        store_inventory_cursor = inventory_collection.find({"store_id": store_id})
        inventory_data = list(store_inventory_cursor)

        if not sales_data:
            raise HTTPException(status_code=404, detail=f"No sales data found for store {store_id}")

        if not inventory_data:
            raise HTTPException(status_code=404, detail=f"No inventory data found for store {store_id}")

        print(f"✅ Found {len(sales_data)} sales records and {len(inventory_data)} inventory items")

        # Convert to DataFrames for easier processing
        sales_history = pd.DataFrame(sales_data)
        current_inventory = pd.DataFrame(inventory_data)

        # Parse dates
        if 'date' in sales_history.columns:
            sales_history['date'] = pd.to_datetime(sales_history['date'])

        # Calculate metrics for each product
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
            "Food": 5
        }

        for _, inv_row in current_inventory.iterrows():
            product = inv_row["product"]
            category = inv_row["category"]
            current_stock = inv_row.get("stock_quantity", 0)

            # Get sales history for this product
            product_sales = sales_history[sales_history["product"] == product]

            if len(product_sales) == 0:
                continue

            # Calculate demand statistics
            avg_daily_demand = product_sales["quantity"].mean()
            demand_std = product_sales["quantity"].std()

            if demand_std < 1:
                demand_std = avg_daily_demand * 0.2

            days_of_data = (product_sales["date"].max() - product_sales["date"].min()).days + 1
            total_demand = product_sales["quantity"].sum()
            annual_demand = (total_demand / days_of_data) * 365

            safety_stock = calculate_safety_stock(
                avg_daily_demand,
                demand_std,
                lead_time_days,
                service_level
            )

            reorder_point = calculate_reorder_point(
                avg_daily_demand,
                lead_time_days,
                safety_stock
            )

            unit_cost = unit_costs.get(category, 10)
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
            unit_price = unit_cost * 1.5
            annual_revenue = annual_demand * unit_price

            stock_days = current_stock / avg_daily_demand if avg_daily_demand > 0 else 999

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
                "stock_days": round(stock_days, 1),
                "abc_classification": "",
                "status": ""
                "stock_days": round(stock_days if isinstance(stock_days, (int, float)) else 0, 1),
                "abc_classification": "",
                "status": "",
            })

        metrics_df = pd.DataFrame(metrics_list)
        metrics_df = perform_abc_analysis(metrics_df)

        metrics_df['status'] = metrics_df.apply(
            lambda row: get_stock_status(
                row['current_stock'],
                row['reorder_point'],
                row['safety_stock']
            ),
            axis=1
        )

        metrics_list = metrics_df.to_dict('records')

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

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in inventory optimization: {str(e)}")
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
