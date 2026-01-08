from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import pandas as pd
import os

router = APIRouter(tags=["purchase_orders"])

# German supplier templates
GERMAN_SUPPLIERS = {
    "Metro": {
        "name": "Metro Cash & Carry Deutschland",
        "address": "Metro-Straße 1, 40235 Düsseldorf",
        "contact": "bestellung@metro.de",
        "phone": "+49 211 6886-0",
        "payment_terms": "30 Tage netto",
        "currency": "EUR",
        "vat_rate": 0.19
    },
    "EDEKA": {
        "name": "EDEKA Handelsgesellschaft",
        "address": "New-York-Ring 6, 22297 Hamburg",
        "contact": "order@edeka.de",
        "phone": "+49 40 6377-0",
        "payment_terms": "14 Tage netto",
        "currency": "EUR",
        "vat_rate": 0.19
    },
    "REWE": {
        "name": "REWE Markt GmbH",
        "address": "Domstraße 20, 50668 Köln",
        "contact": "bestellung@rewe.de",
        "phone": "+49 221 149-0",
        "payment_terms": "30 Tage netto",
        "currency": "EUR",
        "vat_rate": 0.19
    },
    "Aldi": {
        "name": "ALDI Einkauf GmbH & Co. OHG",
        "address": "Eckenbergstraße 16, 45307 Essen",
        "contact": "einkauf@aldi.de",
        "phone": "+49 201 8593-0",
        "payment_terms": "Sofort",
        "currency": "EUR",
        "vat_rate": 0.19
    },
    "Lidl": {
        "name": "Lidl Dienstleistung GmbH & Co. KG",
        "address": "Stiftsbergstraße 1, 74172 Neckarsulm",
        "contact": "bestellung@lidl.de",
        "phone": "+49 7132 30-0",
        "payment_terms": "14 Tage netto",
        "currency": "EUR",
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
    text += f"{'Pos':<5} {'Artikel':<30} {'Menge':<10} {'Preis':<12} {'Gesamt':<12}\n"
    text += f"{'#':<5} {'Description':<30} {'Qty':<10} {'Unit Price':<12} {'Total':<12}\n"
    text += "-" * 80 + "\n"
    
    for idx, item in enumerate(po_data['items'], 1):
        text += f"{idx:<5} {item['description'][:30]:<30} {item['quantity']:<10} "
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
            {"id": key, "name": value["name"], "payment_terms": value["payment_terms"]}
            for key, value in GERMAN_SUPPLIERS.items()
        ]
    }

@router.post("/generate", response_model=PurchaseOrderResponse)
async def generate_purchase_order(request: PurchaseOrderRequest):
    """Generate a purchase order with German formatting"""
    
    # Validate supplier
    if request.supplier not in GERMAN_SUPPLIERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid supplier. Available: {', '.join(GERMAN_SUPPLIERS.keys())}"
        )
    
    supplier_info = GERMAN_SUPPLIERS[request.supplier]
    
    # Generate PO number
    po_number = generate_po_number()
    
    # Calculate dates
    order_date = datetime.now()
    if request.delivery_date:
        delivery_date = datetime.strptime(request.delivery_date, "%Y-%m-%d")
    else:
        # Default: 7 days from now
        delivery_date = order_date + timedelta(days=7)
    
    # Process items and calculate totals
    processed_items = []
    subtotal = 0.0
    
    for item in request.items:
        # Get German description
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
    
    # Calculate additional costs
    shipping_cost = calculate_shipping_cost(subtotal, sum(i.quantity for i in request.items))
    vat_amount = (subtotal + shipping_cost) * supplier_info["vat_rate"]
    total_cost = subtotal + shipping_cost + vat_amount
    
    # Store information
    store_info = {
        "id": request.store_id,
        "name": f"Store {request.store_id}"
    }
    
    # Create PO data
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
    
    # Format as German text
    formatted_text = format_purchase_order_german(po_data)
    po_data["formatted_text"] = formatted_text
    
    return PurchaseOrderResponse(**po_data)

@router.post("/generate-from-recommendations")
async def generate_from_recommendations(
    store_id: str,
    supplier: str,
    notes: Optional[str] = None
):
    """
    Auto-generate PO from inventory optimization recommendations
    Uses current inventory data to determine what needs to be ordered
    """
    
    # Load mock data
    mock_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "mock_data")
    
    try:
        sales_df = pd.read_csv(os.path.join(mock_dir, "sales_history.csv"))
        inventory_df = pd.read_csv(os.path.join(mock_dir, "current_inventory.csv"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading data: {str(e)}")
    
    # Determine likely column names (robust to different mock file formats)
    def pick_column(df, candidates):
        for c in candidates:
            if c in df.columns:
                return c
        return None

    store_col = pick_column(sales_df, ['store_id', 'Store', 'StoreId', 'StoreID'])
    sales_product_col = pick_column(sales_df, ['product', 'Product', 'product_name'])
    sales_qty_col = pick_column(sales_df, ['quantity', 'Quantity', 'qty'])

    inv_store_col = pick_column(inventory_df, ['store_id', 'Store', 'StoreId', 'StoreID'])
    inv_product_col = pick_column(inventory_df, ['product', 'Product', 'product_name'])
    inv_stock_col = pick_column(inventory_df, ['stock_quantity', 'quantity', 'stock', 'CurrentStock'])

    sid = str(store_id)
    if not store_col or not inv_store_col:
        raise HTTPException(status_code=500, detail="Unexpected mock CSV format: missing store column")

    store_sales = sales_df[sales_df[store_col].astype(str) == sid]
    store_inventory = inventory_df[inventory_df[inv_store_col].astype(str) == sid]
    
    if store_sales.empty or store_inventory.empty:
        raise HTTPException(status_code=404, detail=f"No data found for store {store_id}")
    
    # Calculate what needs to be ordered
    items = []
    for _, inv_row in store_inventory.iterrows():
        product = inv_row.get(inv_product_col) if inv_product_col else None
        current_stock = inv_row.get(inv_stock_col) if inv_stock_col else 0
        
        # Calculate average daily demand
        if sales_product_col:
            product_sales = store_sales[store_sales[sales_product_col] == product]
        else:
            product_sales = pd.DataFrame()
        if not product_sales.empty:
            avg_daily_demand = product_sales['Quantity'].mean()
            
            # Simple reorder logic: if stock < 7 days of demand
            reorder_threshold = avg_daily_demand * 7
            
            if current_stock < reorder_threshold:
                # Order 14 days worth of stock
                order_qty = int(avg_daily_demand * 14)
                
                # Get product info
                # Handle possible category/price column names
                category_col = pick_column(product_sales, ['category', 'Category'])
                price_col = pick_column(product_sales, ['price', 'Price', 'unit_price'])
                category = product_sales[category_col].iloc[0] if category_col in product_sales.columns else 'Uncategorized'
                unit_price = float(product_sales[price_col].mean()) if price_col in product_sales.columns else 1.0
                
                items.append(PurchaseOrderItem(
                    product_name=product,
                    category=category,
                    quantity=order_qty,
                    unit_price=unit_price
                ))
    
    if not items:
        raise HTTPException(
            status_code=200,
            detail="No items need reordering at this time"
        )
    
    # Generate PO with the items
    po_request = PurchaseOrderRequest(
        store_id=store_id,
        supplier=supplier,
        items=items,
        notes=notes or "Auto-generiert basierend auf Lagerbestandsempfehlungen"
    )
    
    return await generate_purchase_order(po_request)
