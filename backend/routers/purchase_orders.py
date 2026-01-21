from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import pandas as pd
import os
from database import db, sales_collection, inventory_collection, products_collection, forecasts_collection, stores_collection

router = APIRouter(tags=["purchase_orders"])
purchase_orders_collection = db["purchase_orders"]
# German supplier templates
GERMAN_SUPPLIERS = {
    "Metro": {
        "name": "Metro Cash & Carry Deutschland",
        "address": "Metro-Straße 1, 40235 Düsseldorf",
        "contact": "bestellung@metro.de",
        "phone": "+49 211 6886-0",
        "payment_terms": "30 Tage netto",
        "currency": "EUR",
        "lead_time": 3,
        "vat_rate": 0.19
    },
    "EDEKA": {
        "name": "EDEKA Handelsgesellschaft",
        "address": "New-York-Ring 6, 22297 Hamburg",
        "contact": "order@edeka.de",
        "phone": "+49 40 6377-0",
        "payment_terms": "14 Tage netto",
        "currency": "EUR",
        "lead_time": 5,
        "vat_rate": 0.19
    },
    "REWE": {
        "name": "REWE Markt GmbH",
        "address": "Domstraße 20, 50668 Köln",
        "contact": "bestellung@rewe.de",
        "phone": "+49 221 149-0",
        "payment_terms": "30 Tage netto",
        "currency": "EUR",
        "lead_time": 4,
        "vat_rate": 0.19
    },
    "Aldi": {
        "name": "ALDI Einkauf GmbH & Co. OHG",
        "address": "Eckenbergstraße 16, 45307 Essen",
        "contact": "einkauf@aldi.de",
        "phone": "+49 201 8593-0",
        "payment_terms": "Sofort",
        "currency": "EUR",
        "lead_time": 2,
        "vat_rate": 0.19
    },
    "Lidl": {
        "name": "Lidl Dienstleistung GmbH & Co. KG",
        "address": "Stiftsbergstraße 1, 74172 Neckarsulm",
        "contact": "bestellung@lidl.de",
        "phone": "+49 7132 30-0",
        "payment_terms": "14 Tage netto",
        "currency": "EUR",
        "lead_time": 2,
        "vat_rate": 0.19
    }
}

# Product categories with German translations
CATEGORY_TRANSLATIONS = {
    "Electronics": "Elektronik",
    "Clothing": "Bekleidung",
    "Food": "Lebensmittel",
    "Furniture": "Möbel",
    "Toys": "Spielwaren",
    "Books": "Bücher",
    "Sports": "Sportartikel"
}

# Standard product descriptions in German
PRODUCT_DESCRIPTIONS = {
    "Laptop": "Notebook Computer, 15 Zoll Display, Windows 11",
    "Smartphone": "Mobiltelefon, 6.5 Zoll Touchscreen, 128GB Speicher",
    "Headphones": "Kopfhörer, kabellos, Bluetooth 5.0, Noise-Cancelling",
    "T-Shirt": "T-Shirt, 100% Baumwolle, verschiedene Größen",
    "Jeans": "Jeans, Denim, verschiedene Größen und Farben",
    "Jacket": "Jacke, wasserabweisend, verschiedene Größen",
    "Bread": "Brot, frisch gebacken, verschiedene Sorten",
    "Milk": "Milch, 3.5% Fett, 1 Liter Packung",
    "Eggs": "Eier, Freilandhaltung, 10 Stück Packung"
}

class PurchaseOrderItem(BaseModel):
    product_name: str
    category: str
    quantity: int
    unit_price: float
    description: Optional[str] = None

class PurchaseOrderRequest(BaseModel):
    store_id: str
    supplier: str
    items: List[PurchaseOrderItem]
    delivery_date: Optional[str] = None
    notes: Optional[str] = None

class PurchaseOrderResponse(BaseModel):
    po_number: str
    supplier_info: dict
    store_info: dict
    order_date: str
    delivery_date: str
    items: List[dict]
    subtotal: float
    shipping_cost: float
    vat_amount: float
    total_cost: float
    payment_terms: str
    formatted_text: str

class DeliveryConfirmation(BaseModel):
    po_number: str
    items_received: List[dict]

def generate_po_number() -> str:
    """Generate unique PO number in German format"""
    now = datetime.now()
    return f"BE-{now.strftime('%Y%m%d')}-{now.strftime('%H%M%S')}"

def get_german_description(product_name: str, category: str) -> str:
    """Get German product description"""
    if product_name in PRODUCT_DESCRIPTIONS:
        return PRODUCT_DESCRIPTIONS[product_name]
    
    # Fallback to category-based description
    category_de = CATEGORY_TRANSLATIONS.get(category, category)
    return f"{product_name} - {category_de}"

def calculate_shipping_cost(subtotal: float, item_count: int) -> float:
    """Calculate shipping cost based on order size"""
    if subtotal >= 500:
        return 0.0  # Free shipping for large orders
    elif item_count > 50:
        return 25.0
    elif item_count > 20:
        return 15.0
    else:
        return 10.0

def format_purchase_order_german(po_data: dict) -> str:
    """Format purchase order in German format"""
    supplier = po_data['supplier_info']
    store = po_data['store_info']
    
    # Header
    text = "=" * 80 + "\n"
    text += f"BESTELLUNG / PURCHASE ORDER\n"
    text += f"Bestellnummer: {po_data['po_number']}\n"
    text += "=" * 80 + "\n\n"
    
    # Supplier information
    text += "LIEFERANT / SUPPLIER:\n"
    text += "-" * 40 + "\n"
    text += f"{supplier['name']}\n"
    text += f"{supplier['address']}\n"
    text += f"Tel: {supplier['phone']}\n"
    text += f"E-Mail: {supplier['contact']}\n\n"
    
    # Store information
    text += "KÄUFER / BUYER:\n"
    text += "-" * 40 + "\n"
    text += f"{store['name']}\n"
    text += f"Filiale Nr. {store['id']}\n\n"
    
    # Order details
    text += "BESTELLDETAILS / ORDER DETAILS:\n"
    text += "-" * 40 + "\n"
    text += f"Bestelldatum / Order Date: {po_data['order_date']}\n"
    text += f"Lieferdatum / Delivery Date: {po_data['delivery_date']}\n"
    text += f"Zahlungsbedingungen / Payment Terms: {po_data['payment_terms']}\n\n"
    
    # Items table
    text += "ARTIKEL / ITEMS:\n"
    text += "=" * 80 + "\n"
    text += f"{'Pos':<5} {'Artikel':<40} {'Menge':<10} {'Preis':<12} {'Gesamt':<12}\n"
    text += f"{'#':<5} {'Product':<40} {'Qty':<10} {'Unit Price':<12} {'Total':<12}\n"
    text += "-" * 80 + "\n"
    
    for idx, item in enumerate(po_data['items'], 1):
        text += f"{idx:<5} {item['product_name'][:40]:<40} {item['quantity']:<10} "
        text += f"€{item['unit_price']:>9.2f} €{item['line_total']:>9.2f}\n"
    
    text += "=" * 80 + "\n"
    
    # Totals
    text += f"{'Zwischensumme / Subtotal:':<60} €{po_data['subtotal']:>12.2f}\n"
    text += f"{'Versandkosten / Shipping:':<60} €{po_data['shipping_cost']:>12.2f}\n"
    text += f"{'MwSt. 19% / VAT 19%:':<60} €{po_data['vat_amount']:>12.2f}\n"
    text += "-" * 80 + "\n"
    text += f"{'GESAMTSUMME / TOTAL:':<60} €{po_data['total_cost']:>12.2f}\n"
    text += "=" * 80 + "\n\n"
    
    # Notes
    if po_data.get('notes'):
        text += "ANMERKUNGEN / NOTES:\n"
        text += "-" * 40 + "\n"
        text += po_data['notes'] + "\n\n"
    
    # Footer
    text += "WICHTIGE HINWEISE / IMPORTANT NOTES:\n"
    text += "-" * 40 + "\n"
    text += "• Bitte bestätigen Sie den Eingang dieser Bestellung\n"
    text += "  Please confirm receipt of this order\n"
    text += "• Lieferung erfolgt an die oben genannte Adresse\n"
    text += "  Delivery to the address mentioned above\n"
    text += "• Rechnungsstellung gemäß vereinbarten Konditionen\n"
    text += "  Invoicing according to agreed terms\n\n"
    
    text += f"Erstellt am / Created on: {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}\n"
    text += "=" * 80 + "\n"
    
    return text

@router.get("/suppliers")
async def get_suppliers():
    """Get list of available German suppliers"""
    return {
        "suppliers": [
            {"id": key, "name": value["name"], "payment_terms": value["payment_terms"],"lead_time": value["lead_time"]}
            for key, value in GERMAN_SUPPLIERS.items()
        ]
    }


@router.get("/pending/{store_id}")
async def get_pending_orders(store_id: str):
    """Obține toate comenzile cu status 'pending' pentru un magazin specific"""
    try:
        # Căutăm în baza de date comenzile nefinalizate
        orders = list(db["purchase_orders"].find({
            "store_id": store_id,
            "status": "pending"
        }))

        # Pregătim datele pentru frontend (convertim ObjectId și datetime în string-uri)
        for order in orders:
            order["id"] = str(order.pop("_id"))
            if "created_at" in order and isinstance(order["created_at"], datetime):
                order["created_at"] = order["created_at"].isoformat()

        return orders
    except Exception as e:
        print(f"❌ Error fetching pending orders: {e}")
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")


@router.get("/all/{store_id}")
async def get_all_purchase_orders(store_id: str):
    """Obține istoricul complet al comenzilor pentru un magazin"""
    try:
        # Sortăm după data creării (cele mai noi primele)
        orders = list(db["purchase_orders"].find({"store_id": store_id}).sort("created_at", -1))

        for order in orders:
            order["id"] = str(order.pop("_id"))
            if "created_at" in order and isinstance(order["created_at"], datetime):
                order["created_at"] = order["created_at"].isoformat()

        return orders
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/confirm-delivery")
async def confirm_delivery(confirmation: DeliveryConfirmation):
    # 1. Găsim comanda originală
    po = purchase_orders_collection.find_one({"po_number": confirmation.po_number})
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if po["status"] == "received":
        raise HTTPException(status_code=400, detail="This order has already been processed")

    store_id = po["store_id"]

    # 2. Actualizăm stocul pentru fiecare produs primit
    for item in confirmation.items_received:
        product_name = item["product_name"]
        received_qty = item["received_quantity"]

        # Găsim produsul în tabelul products pentru a obține ID-ul corect
        product_doc = db["products"].find_one({"name": product_name})
        if not product_doc:
            continue

        product_id = str(product_doc["_id"])

        # Update în inventory: stoc_actual + received_qty
        db["inventory"].update_one(
            {"store_id": store_id, "product_id": product_id},
            {"$inc": {"quantity": received_qty}},
            upsert=True  # În caz că nu exista în inventar, îl creăm
        )

    purchase_orders_collection.update_one(
        {"po_number": confirmation.po_number},
        {
            "$set": {
                "status": "received",
                "received_at": datetime.utcnow(),
                "actual_received_items": confirmation.items_received
            }
        }
    )

    return {"message": f"Inventory updated for store {store_id}", "status": "success"}

@router.get("/categories/{store_id}")
async def get_po_categories(store_id: str):
    try:
        pipeline = [
            # 1. Începem cu inventory pentru că aici avem filtrul store_id
            {"$match": {"store_id": store_id}},

            # 2. Facem legătura cu tabela products pentru a accesa categoriile
            {
                "$lookup": {
                    "from": "products",
                    "let": {"pid": "$product_id"},
                    "pipeline": [
                        # Conversia ObjectId în string este crucială pentru match
                        {"$match": {"$expr": {"$eq": [{"$toString": "$_id"}, "$$pid"]}}}
                    ],
                    "as": "product_info"
                }
            },

            # 3. Scoatem datele din array-ul rezultat din lookup
            {"$unwind": "$product_info"},

            # 4. Grupăm după categorie (care acum e disponibilă în product_info)
            {"$group": {"_id": "$product_info.category"}},

            # 5. Sortăm alfabetic
            {"$sort": {"_id": 1}}
        ]

        # REZOLVARE: Agregăm din INVENTORY, nu din products
        results = list(db["inventory"].aggregate(pipeline))

        # Extragem doar numele categoriilor
        return [r["_id"] for r in results if r["_id"]]
    except Exception as e:
        print(f"Eroare Backend: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate", response_model=PurchaseOrderResponse)
async def generate_purchase_order(request: PurchaseOrderRequest):
    """Generate a purchase order with German formatting and save to MongoDB"""

    # 1. Validare furnizor
    if request.supplier not in GERMAN_SUPPLIERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid supplier. Available: {', '.join(GERMAN_SUPPLIERS.keys())}"
        )

    supplier_info = GERMAN_SUPPLIERS[request.supplier]

    # 2. Generare număr PO
    po_number = generate_po_number()

    # 3. Calcul date (folosind lead_time furnizor)
    order_date = datetime.now()
    if request.delivery_date:
        delivery_date = datetime.strptime(request.delivery_date, "%Y-%m-%d")
    else:
        # Preluăm lead_time din profilul furnizorului (default 7 zile dacă lipsește)
        lead_days = supplier_info.get("lead_time", 7)
        delivery_date = order_date + timedelta(days=lead_days)

    # 4. Procesare iteme și calcule financiare
    processed_items = []
    subtotal = 0.0

    for item in request.items:
        description = item.description or get_german_description(
            item.product_name,
            item.category
        )

        line_total = item.quantity * item.unit_price
        subtotal += line_total

        processed_items.append({
            "product_name": item.product_name,
            "category": item.category,
            "category_de": CATEGORY_TRANSLATIONS.get(item.category, item.category),
            "description": description,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "line_total": line_total
        })

    # 5. Calcul costuri adiționale
    shipping_cost = calculate_shipping_cost(subtotal, sum(i.quantity for i in request.items))
    vat_amount = (subtotal + shipping_cost) * supplier_info["vat_rate"]
    total_cost = subtotal + shipping_cost + vat_amount

    # 6. Preluare informații magazin din DB
    from bson import ObjectId
    from database import stores_collection

    store_info = {"id": request.store_id, "name": f"Store {request.store_id}"}
    try:
        if ObjectId.is_valid(request.store_id):
            store_doc = stores_collection.find_one({"_id": ObjectId(request.store_id)})
        else:
            store_doc = stores_collection.find_one({"_id": request.store_id})

        if store_doc:
            store_info = {
                "id": str(store_doc.get("_id")),
                "name": store_doc.get("name", f"Store {request.store_id}"),
                "address": store_doc.get("address", ""),
                "market": store_doc.get("market", "")
            }
    except Exception as e:
        print(f"⚠️ Could not fetch store info: {e}")

    # 7. Construire obiect po_data
    po_data = {
        "po_number": po_number,
        "supplier_info": supplier_info,
        "store_info": store_info,
        "order_date": order_date.strftime("%d.%m.%Y"),
        "delivery_date": delivery_date.strftime("%d.%m.%Y"),
        "items": processed_items,
        "subtotal": subtotal,
        "shipping_cost": shipping_cost,
        "vat_amount": vat_amount,
        "total_cost": total_cost,
        "payment_terms": supplier_info["payment_terms"],
        "notes": request.notes or ""
    }

    # 8. Formatare text pentru document
    formatted_text = format_purchase_order_german(po_data)
    po_data["formatted_text"] = formatted_text

    # --- INTEGRARE TRACKING ȘI PERSISTENȚĂ ---
    po_data["status"] = "pending"
    po_data["created_at"] = datetime.utcnow()
    po_data["store_id"] = request.store_id

    try:
        # Salvăm sau actualizăm comanda în colecția purchase_orders
        db["purchase_orders"].update_one(
            {"po_number": po_data["po_number"]},
            {"$set": po_data},
            upsert=True
        )
    except Exception as e:
        print(f"❌ Eroare la salvarea PO în baza de date: {e}")
        raise HTTPException(
            status_code=500,
            detail="Could not save purchase order to database"
        )

    return PurchaseOrderResponse(**po_data)

@router.post("/generate-from-forecast")
async def generate_from_forecast(
    store_id: str,
    supplier: str,
    notes: Optional[str] = None,
    forecast_days: Optional[int] = 7
):
    """
    Auto-generate PO from latest AI forecast (includes seasonality & holidays)
    Uses the most recent forecast saved in the database with the specified period
    
    Args:
        store_id: Store identifier
        supplier: Supplier name
        notes: Optional notes for the PO
        forecast_days: Number of days to use from forecast (default: 7). 
                       Will look for a forecast with this exact period.
    """
    
    try:
        print(f"📊 Looking for latest forecast for store {store_id} with {forecast_days} days period")

        from bson import ObjectId
        
        # Find the most recent forecast for this store with the specified period
        latest_forecast = forecasts_collection.find_one(
            {
                "store_id": str(store_id),
                "forecast_period_days": forecast_days
            },
            sort=[("forecast_date", -1)]
        )
        
        if not latest_forecast:
            # Try to find ANY forecast for this store to provide helpful message
            any_forecast = forecasts_collection.find_one(
                {"store_id": str(store_id)},
                sort=[("forecast_date", -1)]
            )
            
            if any_forecast:
                available_days = any_forecast.get("forecast_period_days", "unknown")
                raise HTTPException(
                    status_code=404, 
                    detail=f"No forecast found for store {store_id} with {forecast_days} days period. Found forecast with {available_days} days. Please generate a {forecast_days}-day forecast first or change the forecast period in Purchase Orders."
                )
            else:
                raise HTTPException(
                    status_code=404, 
                    detail=f"No forecast found for store {store_id}. Please generate a forecast first in the Forecasting page."
                )
        
        forecast_date = latest_forecast.get("forecast_date")
        actual_forecast_days = latest_forecast.get("forecast_period_days", 7)
        products = latest_forecast.get("products", [])
        
        print(f"✅ Found forecast from {forecast_date} ({actual_forecast_days} days, {len(products)} products)")
        print(f"   Using forecast ID: {latest_forecast.get('_id')}")
        print(f"   Forecast created at: {latest_forecast.get('created_at')}")
        
        # Verify the forecast period matches what was requested
        if actual_forecast_days != forecast_days:
            print(f"⚠️  WARNING: Requested {forecast_days} days but found {actual_forecast_days} days forecast!")
            print(f"   Quantities are calculated for {actual_forecast_days} days, not {forecast_days} days.")
        
        if not products:
            return {
                "message": "Forecast exists but contains no products.",
                "store_id": store_id,
                "forecast_date": forecast_date
            }
        
        # Generate PO items based on forecast recommendations
        items = []
        
        print(f"📋 Processing {len(products)} products from forecast:")
        for product_data in products:
            product_identifier = product_data.get("product", "Unknown Product")
            total_forecast = product_data.get("total_forecast", 0)
            current_stock = product_data.get("current_stock", 0)
            recommended_order = product_data.get("recommended_order", 0)
            
            print(f"  • {product_identifier}: forecast={total_forecast}, stock={current_stock}, recommended={recommended_order}")
            
            # Only include products that need ordering
            if recommended_order > 0:
                category = product_data.get("category", "Unknown")
                
                # Try to get product info from products collection
                product_name = product_identifier
                unit_price = 10.0
                try:
                    # Try to find product by ID first
                    product_doc = None
                    if ObjectId.is_valid(product_identifier):
                        product_doc = products_collection.find_one({"_id": ObjectId(product_identifier)})
                    
                    # If not found by ID, try by name
                    if not product_doc:
                        product_doc = products_collection.find_one({"name": product_identifier})
                    
                    if product_doc:
                        product_name = product_doc.get('name', product_identifier)
                        unit_price = float(product_doc.get('price', 10.0))
                    else:
                        print(f"⚠️ Product not found in database: {product_identifier}")
                except Exception as e:
                    print(f"⚠️ Could not get product info for {product_identifier}: {e}")
                
                items.append(PurchaseOrderItem(
                    product_name=product_name,
                    category=category,
                    quantity=int(recommended_order),
                    unit_price=unit_price
                ))
        
        if not items:
            return {
                "message": "No items need reordering according to the forecast. All inventory levels are sufficient for the forecasted demand.",
                "store_id": store_id,
                "forecast_date": forecast_date,
                "products_checked": len(products)
            }
        
        print(f"📦 Generated {len(items)} items to order based on AI forecast")
        
        # Generate PO with the forecast-based items
        po_request = PurchaseOrderRequest(
            store_id=store_id,
            supplier=supplier,
            items=items,
            notes=notes or f"AI-generiert basierend auf Forecast vom {forecast_date.strftime('%d.%m.%Y')} (inkl. Saisonalität & Feiertage)"
        )
        
        return await generate_purchase_order(po_request)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in auto-generate from forecast: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating PO from forecast: {str(e)}")


@router.post("/generate-from-recommendations")
async def generate_from_recommendations(
    store_id: str,
    supplier: str,
    notes: Optional[str] = None
):
    """
    DEPRECATED: Use /generate-from-forecast instead
    Auto-generate PO from inventory optimization recommendations
    Now uses MongoDB data instead of CSV files
    """

    try:
        print(f"📊 Fetching data from MongoDB for store {store_id}")

        # Import products_collection to resolve product names
        from bson import ObjectId

        # Read from MongoDB instead of CSV
        sales_cursor = sales_collection.find({"store_id": str(store_id)})
        sales_data = list(sales_cursor)

        inventory_cursor = inventory_collection.find({"store_id": str(store_id)})
        inventory_data = list(inventory_cursor)

        if not inventory_data:
            raise HTTPException(status_code=404, detail=f"No inventory data found for store {store_id}. Please import inventory data first.")

        print(f"✅ Found {len(sales_data)} sales records and {len(inventory_data)} inventory items")

        # Convert to DataFrames
        sales_df = pd.DataFrame(sales_data) if sales_data else pd.DataFrame()
        inventory_df = pd.DataFrame(inventory_data)

        # Calculate what needs to be ordered
        items = []
        # Track products to avoid duplicates
        products_dict = {}
        
        for _, inv_row in inventory_df.iterrows():
            product_id = inv_row.get('product_id')
            current_stock = inv_row.get('quantity', 0)
            
            # Skip if no product_id
            if not product_id:
                continue

            # If we've already seen this product, just add to stock
            if product_id in products_dict:
                products_dict[product_id]['stock'] += current_stock
                continue

            # First time seeing this product - get product info
            product_name = "Unknown Product"
            category = "Unknown"
            unit_price = 10.0
            
            try:
                if ObjectId.is_valid(product_id):
                    product_doc = products_collection.find_one({"_id": ObjectId(product_id)})
                else:
                    product_doc = products_collection.find_one({"_id": product_id})
                
                if product_doc:
                    product_name = product_doc.get('name', 'Unknown Product')
                    category = product_doc.get('category') or 'Unknown'
                    unit_price = float(product_doc.get('price', 10.0))
            except Exception as e:
                print(f"⚠️ Error resolving product {product_id}: {e}")
            
            # Ensure category is never None
            if category is None:
                category = "Unknown"

            # Calculate average daily demand from sales
            avg_daily_demand = 10  # Default
            if not sales_df.empty:
                product_sales = sales_df[sales_df['product_id'] == product_id]
                if not product_sales.empty:
                    # Parse sale dates
                    if 'sale_date' in product_sales.columns:
                        product_sales['date'] = pd.to_datetime(product_sales['sale_date'])
                    elif 'date' in product_sales.columns:
                        product_sales['date'] = pd.to_datetime(product_sales['date'])
                    else:
                        product_sales['date'] = pd.to_datetime(product_sales['created_at'])
                    
                    # Calculate average daily demand
                    days = (product_sales['date'].max() - product_sales['date'].min()).days + 1
                    total_quantity = product_sales['quantity'].sum()
                    avg_daily_demand = total_quantity / max(1, days)
                    
                    # Get average price if available
                    if 'unit_price' in product_sales.columns:
                        avg_price = product_sales['unit_price'].mean()
                        if pd.notna(avg_price) and avg_price > 0:
                            unit_price = float(avg_price)

            # Store product info (first time)
            products_dict[product_id] = {
                'product_name': product_name,
                'category': category,
                'unit_price': unit_price,
                'stock': current_stock,
                'avg_daily_demand': avg_daily_demand
            }

        print(f"📊 Found {len(products_dict)} unique products in inventory")

        # Now process all unique products and check reorder logic
        for product_id, product_info in products_dict.items():
            # Simple reorder logic: if stock < 7 days of demand
            reorder_threshold = product_info['avg_daily_demand'] * 7

            if product_info['stock'] < reorder_threshold:
                # Order 14 days worth of stock
                order_qty = int(max(1, product_info['avg_daily_demand'] * 14))

                items.append(PurchaseOrderItem(
                    product_name=product_info['product_name'],
                    category=product_info['category'],
                    quantity=order_qty,
                    unit_price=product_info['unit_price']
                ))

        if not items:
            return {
                "message": "No items need reordering at this time. All inventory levels are sufficient.",
                "store_id": store_id,
                "items_checked": len(inventory_data)
            }

        print(f"📦 Generated {len(items)} items to order")

        # Generate PO with the items
        po_request = PurchaseOrderRequest(
            store_id=store_id,
            supplier=supplier,
            items=items,
            notes=notes or "Auto-generiert basierend auf Lagerbestandsempfehlungen"
        )

        return await generate_purchase_order(po_request)

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in auto-generate: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error loading data: {str(e)}")
