from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
from bson import ObjectId
from bson.errors import InvalidId

# Infrastructură și baze de date
from database import db, sales_collection, products_collection, stores_collection
from utils.auth import get_current_user

# Repository (DAL)
from dal.sales_repo import (
    list_sales,
    get_sales_summary,
    get_sales_by_store,
    get_sales_by_product,
)

router = APIRouter(prefix="/sales", tags=["sales"])


# --- Utilități ---

def verify_store_ownership(store_id: str, current_user: Optional[dict]) -> tuple[bool, Optional[str]]:
    """
    Verifică dacă magazinul aparține utilizatorului curent.
    Returnează: (este_proprietar, id_ul_real_din_db)
    """
    if not current_user:
        return False, None

    try:
        # Încercăm după _id (ObjectId) sau după câmpul store_id
        if ObjectId.is_valid(store_id):
            store = stores_collection.find_one({"_id": ObjectId(store_id)})
        else:
            store = stores_collection.find_one({"store_id": store_id})

        if not store:
            return False, None

        # Verificăm ownership (comparăm ID-urile ca stringuri)
        is_owner = str(store.get("user_id")) == str(current_user["_id"])
        return is_owner, str(store["_id"])
    except Exception:
        return False, None


# --- Endpoints ---

@router.get("/", response_model=List[dict])
async def get_sales(
        store_id: Optional[str] = Query(None),
        skip: int = 0,
        limit: int = 100,
        days: Optional[int] = None,
        current_user: dict = Depends(get_current_user)
):
    """
    Obține vânzările. Dacă store_id este furnizat, filtrează și verifică permisiunile.
    Dacă nu, returnează lista generală (pentru admin sau uz general).
    """
    if store_id:
        is_owner, actual_id = verify_store_ownership(store_id, current_user)
        if not is_owner:
            raise HTTPException(status_code=403, detail="Access denied to this store's data")

        # Folosim DAL pentru a filtra după magazin
        return get_sales_by_store(actual_id)

    # Dacă nu e specificat un magazin, returnăm lista generală
    return list_sales(skip=skip, limit=limit, days=days)


@router.get("/summary", response_model=dict)
async def sales_summary(days: int = 30, current_user: dict = Depends(get_current_user)):
    """Obține sumarul vânzărilor pentru ultimele N zile."""
    # În mod normal, aici s-ar adăuga o filtrare per user_id în DAL
    return get_sales_summary(days=days)


@router.get("/monthly")
async def get_monthly_sales(
        store_id: Optional[str] = Query(None),
        current_user: dict = Depends(get_current_user)
):
    """Trendul veniturilor lunare pentru ultimele 6 luni."""
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id is required")

    is_owner, actual_id = verify_store_ownership(store_id, current_user)
    if not is_owner:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Agregare date
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    query = {
        "store_id": actual_id,
        "date": {"$gte": six_months_ago}  # Presupunem format BSON Date conform inventarului
    }

    sales = list(sales_collection.find(query))
    monthly_revenue = defaultdict(float)

    for sale in sales:
        try:
            # Gestionăm atât obiecte datetime cât și string-uri ISO
            d = sale.get("date")
            sale_date = d if isinstance(d, datetime) else datetime.fromisoformat(str(d).replace('Z', '+00:00'))

            month_key = sale_date.strftime("%b")

            # Calculăm venitul
            qty = sale.get("quantity", 0)
            price = sale.get("price", 0)

            # Fallback preț din colecția de produse dacă lipsește în sale
            if not price and sale.get("product_id"):
                prod = products_collection.find_one({"_id": ObjectId(sale["product_id"])})
                if prod:
                    price = prod.get("price", 0)

            monthly_revenue[month_key] += (qty * price)
        except:
            continue

    # Generăm lista pentru ultimele 6 luni (inclusiv cele cu 0)
    result = []
    current_date = datetime.utcnow()
    for i in range(5, -1, -1):
        target_date = current_date - timedelta(days=30 * i)
        m_name = target_date.strftime("%b")
        result.append({
            "month": m_name,
            "revenue": round(monthly_revenue.get(m_name, 0), 2)
        })

    return result


@router.post("/")
async def create_sale(sale: dict, current_user: dict = Depends(get_current_user)):
    """Înregistrează o vânzare nouă."""
    # Asigurăm consistența ID-ului magazinului
    if "store_id" in sale:
        is_owner, actual_id = verify_store_ownership(sale["store_id"], current_user)
        if not is_owner:
            raise HTTPException(status_code=403, detail="Cannot record sale for a store you don't own")
        sale["store_id"] = actual_id

    if "date" not in sale:
        sale["date"] = datetime.utcnow()  # Salvăm ca BSON Date pentru interogări rapide
    elif isinstance(sale["date"], str):
        sale["date"] = datetime.fromisoformat(sale["date"].replace('Z', '+00:00'))

    result = sales_collection.insert_one(sale)
    sale["_id"] = str(result.inserted_id)
    return sale