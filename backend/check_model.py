import joblib

enc = joblib.load('models/encoders.pkl')

print("=" * 60)
print("PRODUCTS IN TRAINED MODEL:")
print("=" * 60)
products = list(enc['product_map'].keys())
print(f"Total products: {len(products)}")
print("\nFirst 20 products:")
for i, prod in enumerate(products[:20], 1):
    print(f"{i}. {prod}")

print("\n" + "=" * 60)
print("CATEGORIES IN TRAINED MODEL:")
print("=" * 60)
categories = list(enc['category_map'].keys())
for cat in categories:
    print(f"- {cat}")

print("\n" + "=" * 60)
print("STORES IN TRAINED MODEL:")
print("=" * 60)
stores = list(enc['store_id_map'].keys())
print(f"Total stores: {len(stores)}")
print(f"First 10 stores: {stores[:10]}")
