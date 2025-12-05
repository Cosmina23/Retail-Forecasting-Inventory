import json
from openpyxl import load_workbook
from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

workbook = load_workbook(filename="test.xlsx")
sheet = workbook.active
products = {}
fields=[]

# Read headers from first row (all columns)
for row in sheet.iter_rows(min_row=1, max_row=1, values_only=True):
   fields = list(row)  # Get all column headers

count=0
# Read data rows (all columns to match headers)
for row in sheet.iter_rows(min_row=2, values_only=True):
    product_id = count
    count+=1
    # Build product dict dynamically based on actual columns
    product = {}
    for i, field in enumerate(fields):
        if i < len(row) and field:  # Only add if field name exists and value is present
            product[field] = row[i]
    
    products[product_id] = product

# Print JSON output for verification
print(json.dumps(products, indent=2, ensure_ascii=False))

# Connect to MongoDB
mongo_uri = os.getenv("MONGO_URI", "mongodb://admin:password@localhost:27017/?authSource=admin")
db_name = os.getenv("MONGO_INITDB_DATABASE", "retail_db")

try:
    client = MongoClient(mongo_uri)
    db = client[db_name]
    collection = db["products"]  # Change collection name if needed
    
    # Convert dict to list of documents
    documents = list(products.values())
    
    # Insert into MongoDB
    if documents:
        result = collection.insert_many(documents)
        print(f"\n✓ Successfully inserted {len(result.inserted_ids)} documents into '{db_name}.products'")
    else:
        print("\n⚠ No documents to insert")
    
    client.close()
    
except Exception as e:
    print(f"\n✗ Error connecting to MongoDB: {e}")
    print("Make sure MongoDB is running (docker compose up -d)")
