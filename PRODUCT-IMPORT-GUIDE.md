# Product Import with Barcode Scanning

This feature allows you to easily add new products to your inventory by scanning barcodes or entering product information manually. It supports German-style product data and can add products to multiple stores simultaneously.

## Features

### 🔍 Barcode Scanning
- **Upload barcode images**: Take a photo of any product barcode and upload it
- **Automatic barcode detection**: Uses computer vision (OpenCV + pyzbar) to extract barcode data
- **Manual barcode entry**: Enter EAN/UPC codes directly if you have them
- **Multiple barcode formats**: Supports EAN-13, EAN-8, UPC-A, UPC-E

### 🌍 Product Database Lookup
- **OpenProductFacts**: Searches the OpenProductFacts database (great for European/German products)
- **UPCItemDB**: Additional lookup for broader product coverage
- **Automatic data population**: Product information is automatically filled from database results
- **Manual override**: You can edit any auto-filled information

### 🇩🇪 German Product Data Support
The system supports comprehensive product information including:
- **Basic Info**: Name, SKU, Category, Price, Stock
- **German Requirements**:
  - Manufacturer (Hersteller)
  - Country of Origin (Herkunftsland)
  - Ingredients (Zutaten)
  - Allergens (Allergene)
  - Product Description
  - Barcode/EAN/GTIN
  - Product Image URL

### 🏪 Multi-Store Support
- Add the same product to multiple stores with one operation
- Select which stores should carry the product
- Initial stock levels are set for all selected stores
- Inventory is automatically created for each store

## How to Use

### 1. Access the Product Import Page
- Navigate to the **Inventory** page
- Click the **"Add Products"** button at the top of the page

### 2. Import via Barcode (Recommended)

#### Option A: Upload Barcode Image
1. Click the **"Barcode Import"** tab
2. Click **"Choose Image"** and select a photo of the barcode
3. The system will:
   - Extract the barcode from the image
   - Search product databases
   - Auto-fill product information
4. Review and edit the populated data if needed

#### Option B: Enter Barcode Manually
1. Click the **"Barcode Import"** tab
2. Enter the barcode number in the input field (e.g., `4001686362037`)
3. Click **"Lookup"**
4. If found, product information will be auto-filled
5. Review and edit as needed

### 3. Manual Entry
1. Click the **"Manual Entry"** tab
2. Fill in all required fields:
   - Product Name *
   - SKU *
   - Price *
3. Add optional information:
   - Category, Manufacturer, Origin Country
   - Description, Ingredients, Allergens
   - Barcode, Image URL

### 4. Select Stores
- Check the boxes for all stores where this product should be available
- At least one store must be selected

### 5. Save
- Click **"Add Product to Selected Stores"**
- The product will be created and added to inventory for all selected stores

## Technical Details

### Frontend Components
- **Page**: `frontend/src/pages/ProductImport.tsx`
- **Barcode Service**: `frontend/src/services/barcode.ts`
- **API Service**: `frontend/src/services/api.ts`

### Backend Endpoints

#### Extract Barcode from Image
```
POST /api/products/extract-barcode
Content-Type: multipart/form-data

Body: { file: <image file> }
Response: { barcodes: ["4001686362037", ...] }
```

#### Create Product with Stores
```
POST /api/products/with-stores
Content-Type: application/json

Body: {
  "name": "Product Name",
  "sku": "SKU-001",
  "barcode": "4001686362037",
  "category": "Food",
  "price": 2.99,
  "current_stock": 100,
  "manufacturer": "Company GmbH",
  "origin_country": "Germany",
  "description": "Product description",
  "ingredients": "Milk, Sugar, ...",
  "allergens": "Milk",
  "image_url": "https://...",
  "selectedStores": [1, 2, 3]
}

Response: { id: "...", stores_added: 3, ... }
```

### Database Schema

The Product model now includes German-specific fields:
```python
class Product(BaseModel):
    id: Optional[str] = None
    name: str
    sku: str
    barcode: Optional[str] = None
    category: Optional[str] = None
    price: float
    current_stock: int = 0
    manufacturer: Optional[str] = None
    origin_country: Optional[str] = None
    description: Optional[str] = None
    ingredients: Optional[str] = None
    allergens: Optional[str] = None
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None
```

## Installation

### Backend Dependencies
The following packages are required for barcode scanning:

```bash
cd backend
pip install opencv-python pyzbar
```

Or install all dependencies:
```bash
pip install -r requirements.txt
```

### System Dependencies for pyzbar
On Linux (Ubuntu/Debian):
```bash
sudo apt-get install libzbar0
```

On macOS:
```bash
brew install zbar
```

On Windows:
- pyzbar should work out of the box with the pre-built wheels

## Tips for Best Results

### Barcode Images
- **Good lighting**: Ensure the barcode is well-lit
- **Clear focus**: The barcode should be sharp and in focus
- **Proper angle**: Hold the camera parallel to the barcode
- **Full barcode**: Include the entire barcode in the image
- **High resolution**: Use higher quality images for better detection

### Product Data
- Always verify auto-filled data before saving
- Some products may not be in the databases - that's okay, just enter manually
- SKU should be unique across all products
- Use consistent category names for easier filtering

### Multiple Stores
- You can add products to all stores at once
- Initial stock is the same for all stores
- You can adjust individual store stock levels later in the Inventory page

## Troubleshooting

### "No barcode detected in the image"
- Try a clearer photo with better lighting
- Ensure the entire barcode is visible
- Try entering the barcode manually

### "Product not found in databases"
- This is normal for many products
- Simply fill in the information manually
- The product will still be added successfully

### "Product with SKU already exists"
- Each product must have a unique SKU
- Check if the product is already in your system
- Use a different SKU or update the existing product

## Future Enhancements
- Webcam support for real-time scanning
- Bulk import via CSV
- Product image upload and storage
- More product database sources
- Barcode generation for custom products
