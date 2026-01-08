export interface ProductInfo {
  source: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  barcode: string;
  manufacturer?: string | null;
  origin_country?: string | null;
  ingredients?: string | null;
  allergens?: string | null;
  nutrition_grade?: string | null;
  image_url?: string | null;
}

export interface BarcodeResult {
  openProductFacts: ProductInfo | null;
  upcItemDB: ProductInfo | null;
}

/**
 * Search OpenProductFacts (formerly OpenFoodFacts) for product information
 * Supports German market products
 */
export async function searchOpenProductFacts(barcode: string): Promise<ProductInfo | null> {
  try {
    const url = `https://world.openproductsfacts.org/api/v0/product/${barcode}.json`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.status !== 1) {
      return null;
    }

    const product = data.product;
    
    return {
      source: "OpenProductFacts",
      barcode,
      name: product.product_name || product.product_name_de || null,
      brand: product.brands || null,
      category: product.categories || null,
      manufacturer: product.manufacturing_places || product.origins || null,
      origin_country: product.countries || null,
      ingredients: product.ingredients_text || product.ingredients_text_de || null,
      allergens: product.allergens || null,
      nutrition_grade: product.nutrition_grade_fr || null,
      image_url: product.image_url || product.image_front_url || null,
    };
  } catch (error) {
    console.error('OpenProductFacts lookup error:', error);
    return null;
  }
}

/**
 * Search UPCItemDB for product information
 * Note: Free tier has rate limits
 */
export async function searchUPCItemDB(barcode: string): Promise<ProductInfo | null> {
  try {
    const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const items = data.items;
    
    if (!items || items.length === 0) {
      return null;
    }

    const item = items[0];
    
    return {
      source: "UPCItemDB",
      barcode,
      name: item.title || null,
      brand: item.brand || null,
      category: item.category || null,
      manufacturer: item.manufacturer || null,
      image_url: item.images?.[0] || null,
    };
  } catch (error) {
    console.error('UPCItemDB lookup error:', error);
    return null;
  }
}

/**
 * Lookup barcode from multiple sources
 * Returns results from both OpenProductFacts and UPCItemDB
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeResult> {
  const [openProductFacts, upcItemDB] = await Promise.all([
    searchOpenProductFacts(barcode),
    searchUPCItemDB(barcode),
  ]);

  return {
    openProductFacts,
    upcItemDB,
  };
}

/**
 * Get the best result from multiple sources
 * Prioritizes OpenProductFacts for European/German products
 */
export function getBestResult(result: BarcodeResult): ProductInfo | null {
  // Prefer OpenProductFacts for European products (better German market coverage)
  if (result.openProductFacts && result.openProductFacts.name) {
    return result.openProductFacts;
  }
  
  if (result.upcItemDB && result.upcItemDB.name) {
    return result.upcItemDB;
  }
  
  return null;
}

/**
 * Validate barcode format
 */
export function validateBarcode(barcode: string): boolean {
  // Remove any whitespace
  const cleaned = barcode.trim();
  
  // Check for common barcode formats:
  // EAN-13: 13 digits
  // EAN-8: 8 digits
  // UPC-A: 12 digits
  // UPC-E: 6-8 digits
  const validLengths = [6, 7, 8, 12, 13, 14];
  const isNumeric = /^\d+$/.test(cleaned);
  
  return isNumeric && validLengths.includes(cleaned.length);
}

// Note: extractBarcodeFromImage is now handled by apiService.extractBarcodeFromImage
// This file focuses on barcode validation and lookup from external APIs
