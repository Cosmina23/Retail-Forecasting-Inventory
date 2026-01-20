import random
from datetime import datetime, timedelta
from pymongo import MongoClient

# --- CONFIGURARE ---
uri = "mongodb://admin:password@localhost:27017/?authSource=admin"
client = MongoClient(uri)
db = client["retail_db"]

STORE_ID = "696ce81eb872b264e9f8d9eb"
TOTAL_SALES = 5000


def populate_realistic_sales():
    products = list(db.products.find({"store_ids": STORE_ID}))
    if not products:
        print("❌ Adaugă produse în magazin mai întâi!")
        return

    sales_batch = []
    start_date = datetime(2026, 1, 17)
    end_date = datetime(2026, 1, 22)
    days_diff = (end_date - start_date).days

    print(f"🚀 Generăm fix {TOTAL_SALES} vânzări optimizate pentru < 100k €...")

    for i in range(TOTAL_SALES):
        product = random.choice(products)
        p_id = str(product["_id"])

        # LOGICĂ MATEMATICĂ:
        # Target total: ~95.000 € / 5000 orders = ~19 € per order.
        # Setăm preț mic și cantitate mică (1-2 bucăți).
        unit_price = random.uniform(8.0, 12.0)
        quantity = random.randint(1, 2)
        total_amount = round(quantity * unit_price, 2)

        random_day = start_date + timedelta(days=random.randint(0, days_diff))
        sale_date = random_day + timedelta(hours=random.randint(9, 21), minutes=random.randint(0, 59))

        sales_batch.append({
            "product_id": p_id,
            "store_id": STORE_ID,
            "quantity": quantity,
            "total_amount": total_amount,
            "unit_price": round(unit_price, 2),
            "sale_date": sale_date,
            "day_of_week": sale_date.strftime("%A"),
            "is_weekend": sale_date.weekday() >= 5,
            "is_holiday": False,
            "created_at": datetime.utcnow()
        })

        if len(sales_batch) >= 1000:
            db.sales.insert_many(sales_batch)
            sales_batch = []

    if sales_batch:
        db.sales.insert_many(sales_batch)

    print(f"✅ Succes! Verifică dashboard-ul.")
    print(f"📊 Estimare Revenue: ~90.000 - 95.000 €")


if __name__ == "__main__":
    populate_realistic_sales()