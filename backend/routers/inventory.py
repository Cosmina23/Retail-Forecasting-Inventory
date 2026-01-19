from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel
from typing import List, Dict, Optional
import pandas as pd
import numpy as np
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId

# Importuri din arhitectura DAL
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
from dal.products_repo import get_product_by_id

# Importuri infrastructură
from database import db, sales_collection, inventory_collection, products_collection
from models import InventoryOptimizationResponse
from utils.auth import get_current_user

router = APIRouter()
stores_collection = db["stores"]


# --- Utilități interne pentru stabilitate ---

def get_uid(user):
    """Extrage ID-ul utilizatorului indiferent de format (dict/string)."""
    if isinstance(user, dict):
        return user.get("_id")
    return user


def serialize_mongo(doc):
    """Transformă ObjectId în string recursiv pentru a evita erorile de serializare."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_mongo(item) for item in doc]
    if isinstance(doc, dict):
        new_doc = {}
        for k, v in doc.items():
            key = "id" if k == "_id" else k
            new_doc[key] = str(v) if isinstance(v, ObjectId) else serialize_mongo(v)
        return new_doc
    return doc


# --- ENDPOINTS ---

@router.get("/store/{store_id}")
def get_inventory_for_store(
        store_id: str,
        skip: int = 0,
        limit: int = 100,
        current_user: any = Depends(get_current_user),
):
    """Returnează inventarul paginat cu verificare de ownership."""
    store = get_store_by_id(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    # VERIFICARE OWNERSHIP SIGURĂ
    uid = get_uid(current_user)
    if str(store.get("user_id")) != str(uid):
        raise HTTPException(status_code=403, detail="Forbidden: Access denied")

    items = get_inventory_by_store(store_id, skip=skip, limit=limit)

    # Îmbogățire date cu info din colecția de produse
    for item in items:
        pid = item.get("product_id")
        if pid and ObjectId.is_valid(pid):
            prod = products_collection.find_one({"_id": ObjectId(pid)})
            if prod:
                item["product_sku"] = prod.get("sku")
                item["product_name"] = prod.get("name")

    total = int(inventory_collection.count_documents({"store_id": store_id}))

    # Folosim serializarea pentru a evita eroarea ObjectId
    return serialize_mongo({"items": items, "total": total})


@router.get("/low-stock/{store_id}", response_model=List[dict])
def get_low_stock_for_store(store_id: str, current_user: any = Depends(get_current_user)):
    """Returnează produsele cu stoc critic."""
    store = get_store_by_id(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    uid = get_uid(current_user)
    if str(store.get("user_id")) != str(uid):
        raise HTTPException(status_code=403, detail="Forbidden")

    items = get_low_stock(store_id)
    for item in items:
        pid = item.get("product_id")
        if pid and ObjectId.is_valid(pid):
            prod = products_collection.find_one({"_id": ObjectId(pid)})
            if prod:
                item["product_sku"] = prod.get("sku")
                item["product_name"] = prod.get("name")

    return serialize_mongo(items)


@router.get("/optimize/{store_id}", response_model=InventoryOptimizationResponse)
async def optimize_inventory(
        store_id: str,
        lead_time_days: int = 7,
        service_level: float = 0.95,
        current_user: any = Depends(get_current_user)
):
    """Calculează metricile de optimizare folosind legătura prin Nume Produs (conform DB)."""
    try:
        # 1. Validare magazin și ownership
        store = get_store_by_id(store_id)
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")

        uid = get_uid(current_user)
        if str(store.get("user_id")) != str(uid):
            raise HTTPException(status_code=403, detail="Forbidden: You do not own this store")

        inventory_items = get_inventory_by_store(store_id)
        if not inventory_items:
            raise HTTPException(status_code=404, detail=f"No inventory found for store {store_id}")

        metrics_list = []
        unit_costs_default = {"Electronics": 100, "Clothing": 30, "Food": 5}

        for item in inventory_items:
            prod_id = item.get("product_id")
            product = get_product_by_id(prod_id) if prod_id else None
            if not product:
                # try to fetch directly from collection if sanitization removed expected fields
                try:
                    raw = products_collection.find_one({"_id": ObjectId(prod_id)}) if prod_id and ObjectId.is_valid(prod_id) else None
                    product = raw or {}
                except Exception:
                    product = {}

            category = product.get("category") or product.get("cat") or "Uncategorized"
            current_stock = int(item.get("stock_quantity") or item.get("quantity") or 0)

            # Use canonical product name and cost fields from products collection
            product_name = product.get("name") or product.get("product_name")
            unit_cost = product.get("cost") or product.get("price") or product.get("unit_price") or 10.0

            if not product_name:
                # If no name, skip this item (cannot link sales)
                continue

            # 2. Fetch sales by product_id and store_id (sales store product_id, not product name)
            avg_daily_demand, demand_std, annual_demand = 0.0, 0.0, 0.0

            sales_query = {"product_id": prod_id, "store_id": str(store_id)} if prod_id else {"store_id": str(store_id)}
            sales = list(sales_collection.find(sales_query))

            if sales:
                df = pd.DataFrame([{
                    "date": s.get("sale_date") or s.get("date") or s.get("created_at"),
                    "quantity": s.get("quantity", 0)
                } for s in sales])

                df["date"] = pd.to_datetime(df["date"])

                if not df.empty:
                    # Calculăm perioada reală din datele de vânzări
                    total_days = (df["date"].max() - df["date"].min()).days + 1
                    avg_daily_demand = df["quantity"].sum() / max(1, total_days)
                    demand_std = df["quantity"].std()

                    if pd.isna(demand_std) or demand_std < 0.1:
                        demand_std = max(0.1, avg_daily_demand * 0.2)

                    annual_demand = avg_daily_demand * 365

            # 3. Calcule optimizare
            safety_stock = calculate_safety_stock(avg_daily_demand, demand_std, lead_time_days, service_level)
            reorder_point = calculate_reorder_point(avg_daily_demand, lead_time_days, safety_stock)

            # EOQ (Order Quantity)
            try:
                eoq = calculate_eoq(annual_demand, unit_cost=float(unit_cost) if unit_cost is not None else 10.0)
            except Exception:
                eoq = 0

            metrics_list.append({
                "product": product_name,
                "category": category,
                "current_stock": current_stock,
                "avg_daily_demand": round(avg_daily_demand, 2),
                "demand_std": round(demand_std, 2),
                "reorder_point": int(reorder_point),
                "safety_stock": int(ss) if 'ss' in locals() else int(safety_stock),
                "recommended_order_qty": int(eoq) if current_stock <= reorder_point else 0,
                "annual_revenue": round(annual_demand * (float(unit_cost) * 1.5), 2) if unit_cost else 0.0,
                "stock_days": round(current_stock / avg_daily_demand if avg_daily_demand > 0 else 999, 1),
                "abc_classification": "C",  # Placeholder
                "status": ""  # Placeholder
            })

        if not metrics_list:
            raise HTTPException(status_code=404, detail="Could not calculate metrics")

        # 4. Analiză ABC și Status Final
        metrics_df = pd.DataFrame(metrics_list)
        metrics_df = perform_abc_analysis(metrics_df)
        metrics_df['status'] = metrics_df.apply(
            lambda r: get_stock_status(r['current_stock'], r['reorder_point'], r['safety_stock']), axis=1
        )

        return serialize_mongo({
            "store_id": store_id,
            "total_products": len(metrics_list),
            "metrics": metrics_df.to_dict('records'),
            "abc_summary": {
                "A": int(metrics_df[metrics_df['abc_classification'] == 'A'].shape[0]),
                "B": int(metrics_df[metrics_df['abc_classification'] == 'B'].shape[0]),
                "C": int(metrics_df[metrics_df['abc_classification'] == 'C'].shape[0])
            },
            "total_annual_revenue": float(metrics_df['annual_revenue'].sum())
        })
    except Exception as e:
        print(f"Optimization error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stores")
async def get_stores_for_inventory(current_user: any = Depends(get_current_user)):
    """Returnează magazinele utilizatorului pentru selectorul de inventar."""
    try:
        uid = get_uid(current_user)
        query = {"user_id": ObjectId(uid) if ObjectId.is_valid(uid) else uid}

        # Căutăm magazinele (încercăm ambele variante de ID)
        stores = list(
            stores_collection.find({"$or": [query, {"user_id": str(uid)}]}, {"_id": 1, "name": 1, "store_id": 1}))

        result = []
        for store in stores:
            s_id = str(store.get("_id"))
            result.append({"id": s_id, "name": store.get("name", f"Store {s_id}")})
        return {"stores": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def get_inventory(store_id: Optional[str] = None, current_user: any = Depends(get_current_user)):
    """Endpoint simplificat pentru Pie Chart Dashboard."""
    if not store_id:
        return []

    try:
        # Validare proprietate
        try:
            store = stores_collection.find_one({"_id": ObjectId(store_id)})
        except:
            store = stores_collection.find_one({"store_id": store_id})

        uid = get_uid(current_user)
        if not store or str(store.get("user_id")) != str(uid):
            return []

        actual_id = str(store["_id"])
        items = list(inventory_collection.find({"store_id": actual_id}))

        return serialize_mongo([{
            "id": str(i["_id"]),
            "product": i.get("product") or i.get("product_name") or "Unknown",
            "category": i.get("category") or "Other",
            "stock_quantity": i.get("stock_quantity") or i.get("quantity") or 0,
            "quantity": i.get("quantity") or i.get("stock_quantity") or 0,
            "reorder_level": i.get("reorder_level", 0),
            "price": i.get("price", 0)
        } for i in items])
    except:
        return []