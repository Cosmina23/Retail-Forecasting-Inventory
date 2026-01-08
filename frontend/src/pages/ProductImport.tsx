import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, 
  Barcode, 
  Upload, 
  Search, 
  Plus, 
  Trash2, 
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { apiService } from "@/services/api";
import { 
  lookupBarcode, 
  validateBarcode,
  getBestResult,
  type ProductInfo,
  type BarcodeResult
} from "@/services/barcode";

interface Store {
  id: number;
  name: string;
}

interface ProductFormData {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  price: number;
  current_stock: number;
  manufacturer: string;
  origin_country: string;
  description: string;
  ingredients: string;
  allergens: string;
  image_url: string;
  selectedStores: number[];
}

const initialFormData: ProductFormData = {
  name: "",
  sku: "",
  barcode: "",
  category: "",
  price: 0,
  current_stock: 0,
  manufacturer: "",
  origin_country: "",
  description: "",
  ingredients: "",
  allergens: "",
  image_url: "",
  selectedStores: [],
};

const ProductImport = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [stores, setStores] = useState<Store[]>([]);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [barcodeResults, setBarcodeResults] = useState<BarcodeResult | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const response = await apiService.getInventoryStores();
      setStores(response.stores);
    } catch (error) {
      console.error("Failed to load stores:", error);
      toast.error("Failed to load stores");
    }
  };

  const handleBarcodeSearch = async () => {
    if (!validateBarcode(barcodeInput)) {
      toast.error("Invalid barcode format. Please enter a valid EAN/UPC code.");
      return;
    }

    setLoading(true);
    try {
      const results = await lookupBarcode(barcodeInput);
      setBarcodeResults(results);
      
      const bestResult = getBestResult(results);
      if (bestResult) {
        populateFormFromBarcode(bestResult);
        toast.success(`Product found: ${bestResult.name}`);
      } else {
        toast.warning("Product not found in databases. Please enter details manually.");
        setFormData(prev => ({ ...prev, barcode: barcodeInput }));
      }
    } catch (error) {
      console.error("Barcode lookup error:", error);
      toast.error("Failed to lookup barcode");
    } finally {
      setLoading(false);
    }
  };

  const populateFormFromBarcode = (info: ProductInfo) => {
    setFormData(prev => ({
      ...prev,
      name: info.name || "",
      barcode: info.barcode,
      category: info.category || "",
      manufacturer: info.manufacturer || "",
      origin_country: info.origin_country || "",
      ingredients: info.ingredients || "",
      allergens: info.allergens || "",
      image_url: info.image_url || "",
      sku: info.barcode, // Default SKU to barcode
    }));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Extract barcode
    setExtracting(true);
    try {
      const response = await apiService.extractBarcodeFromImage(file);
      const barcodes = response.barcodes || [];
      
      if (barcodes.length === 0) {
        toast.warning("No barcode detected in image. Please try another image or enter manually.");
        setExtracting(false);
        return;
      }

      const barcode = barcodes[0];
      setBarcodeInput(barcode);
      toast.success(`Barcode detected: ${barcode}`);
      
      // Automatically lookup the detected barcode
      const results = await lookupBarcode(barcode);
      setBarcodeResults(results);
      
      const bestResult = getBestResult(results);
      if (bestResult) {
        populateFormFromBarcode(bestResult);
        toast.success(`Product identified: ${bestResult.name}`);
      } else {
        setFormData(prev => ({ ...prev, barcode }));
        toast.info("Barcode detected but product not found. Please fill in details.");
      }
    } catch (error: any) {
      console.error("Image processing error:", error);
      toast.error(error?.message || "Failed to process image. Make sure opencv-python and pyzbar are installed.");
    } finally {
      setExtracting(false);
    }
  };

  const handleStoreToggle = (storeId: number) => {
    setFormData(prev => ({
      ...prev,
      selectedStores: prev.selectedStores.includes(storeId)
        ? prev.selectedStores.filter(id => id !== storeId)
        : [...prev.selectedStores, storeId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.sku || formData.selectedStores.length === 0) {
      toast.error("Please fill in required fields and select at least one store");
      return;
    }

    setLoading(true);
    try {
      console.log('Submitting product data:', formData);
      const result = await apiService.createProductWithStores(formData);
      console.log('Product created:', result);
      toast.success(`Product "${formData.name}" added to ${formData.selectedStores.length} store(s)!`);
      
      // Reset form
      setFormData(initialFormData);
      setBarcodeInput("");
      setBarcodeResults(null);
      setUploadedImage(null);
      
      // Optionally navigate back
      // navigate('/inventory');
    } catch (error: any) {
      console.error("Failed to create product:", error);
      const errorMessage = error?.message || error?.detail || "Failed to add product. Please check the console for details.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const selectBarcodeSource = (source: 'openProductFacts' | 'upcItemDB') => {
    const info = source === 'openProductFacts' 
      ? barcodeResults?.openProductFacts 
      : barcodeResults?.upcItemDB;
    
    if (info) {
      populateFormFromBarcode(info);
      toast.success(`Using data from ${info.source}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Add New Products</h1>
            <p className="text-muted-foreground">Import products using barcode scanning or manual entry</p>
          </div>
        </div>

        <Tabs defaultValue="barcode" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="barcode">
              <Barcode className="w-4 h-4 mr-2" />
              Barcode Import
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Plus className="w-4 h-4 mr-2" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="barcode" className="space-y-6">
            {/* Barcode Scanning Section */}
            <Card>
              <CardHeader>
                <CardTitle>Scan or Upload Barcode</CardTitle>
                <CardDescription>
                  Upload a photo of the barcode or enter it manually
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Image Upload */}
                <div className="space-y-2">
                  <Label>Upload Barcode Image</Label>
                  <div className="flex gap-4 items-start">
                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={extracting}
                      >
                        {extracting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Extracting Barcode...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Choose Image
                          </>
                        )}
                      </Button>
                    </div>
                    {uploadedImage && (
                      <div className="w-32 h-32 border rounded overflow-hidden">
                        <img 
                          src={uploadedImage} 
                          alt="Uploaded barcode" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Manual Barcode Entry */}
                <div className="space-y-2">
                  <Label htmlFor="barcode-input">Or Enter Barcode Manually</Label>
                  <div className="flex gap-2">
                    <Input
                      id="barcode-input"
                      placeholder="Enter EAN/UPC code (e.g., 4001686362037)"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleBarcodeSearch()}
                    />
                    <Button onClick={handleBarcodeSearch} disabled={loading || !barcodeInput}>
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Lookup
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Barcode Results */}
                {barcodeResults && (
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="font-semibold">Search Results:</h4>
                    
                    {barcodeResults.openProductFacts && (
                      <Alert>
                        <CheckCircle2 className="w-4 h-4" />
                        <AlertDescription>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">[OpenProductFacts]</p>
                              <p>Name: {barcodeResults.openProductFacts.name}</p>
                              <p>Brand: {barcodeResults.openProductFacts.brand}</p>
                              <p>Category: {barcodeResults.openProductFacts.category}</p>
                            </div>
                            <Button 
                              size="sm" 
                              onClick={() => selectBarcodeSource('openProductFacts')}
                            >
                              Use This
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {barcodeResults.upcItemDB && (
                      <Alert>
                        <CheckCircle2 className="w-4 h-4" />
                        <AlertDescription>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">[UPCItemDB]</p>
                              <p>Name: {barcodeResults.upcItemDB.name}</p>
                              <p>Brand: {barcodeResults.upcItemDB.brand}</p>
                              <p>Category: {barcodeResults.upcItemDB.category}</p>
                            </div>
                            <Button 
                              size="sm" 
                              onClick={() => selectBarcodeSource('upcItemDB')}
                            >
                              Use This
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {!barcodeResults.openProductFacts && !barcodeResults.upcItemDB && (
                      <Alert>
                        <AlertCircle className="w-4 h-4" />
                        <AlertDescription>
                          No product information found. Please fill in the details manually below.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual">
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Fill in product details manually or use the Barcode Import tab to automatically populate fields.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        {/* Product Details Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
              <CardDescription>
                Complete the product information (fields marked with * are required)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Organic Milk 1L"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="e.g., MILK-ORG-1L"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode (EAN/GTIN)</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="e.g., 4001686362037"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Food">Food</SelectItem>
                      <SelectItem value="Beverages">Beverages</SelectItem>
                      <SelectItem value="Dairy">Dairy</SelectItem>
                      <SelectItem value="Bakery">Bakery</SelectItem>
                      <SelectItem value="Meat">Meat</SelectItem>
                      <SelectItem value="Produce">Produce</SelectItem>
                      <SelectItem value="Frozen">Frozen</SelectItem>
                      <SelectItem value="Household">Household</SelectItem>
                      <SelectItem value="Personal Care">Personal Care</SelectItem>
                      <SelectItem value="Electronics">Electronics</SelectItem>
                      <SelectItem value="Clothing">Clothing</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Price (€) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stock">Initial Stock</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    value={formData.current_stock}
                    onChange={(e) => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* German Product Data */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">German Product Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer">Manufacturer</Label>
                    <Input
                      id="manufacturer"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      placeholder="e.g., Deutsche Molkerei GmbH"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="origin">Country of Origin</Label>
                    <Input
                      id="origin"
                      value={formData.origin_country}
                      onChange={(e) => setFormData({ ...formData, origin_country: e.target.value })}
                      placeholder="e.g., Germany"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Product description..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="ingredients">Ingredients (Zutaten)</Label>
                    <Textarea
                      id="ingredients"
                      value={formData.ingredients}
                      onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                      placeholder="List of ingredients..."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="allergens">Allergens (Allergene)</Label>
                    <Input
                      id="allergens"
                      value={formData.allergens}
                      onChange={(e) => setFormData({ ...formData, allergens: e.target.value })}
                      placeholder="e.g., Milk, Gluten"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="image_url">Image URL</Label>
                    <Input
                      id="image_url"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              {/* Store Selection */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Add to Stores *</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {stores.map((store) => (
                    <div key={store.id} className="flex items-center space-x-2 border p-3 rounded">
                      <Checkbox
                        id={`store-${store.id}`}
                        checked={formData.selectedStores.includes(store.id)}
                        onCheckedChange={() => handleStoreToggle(store.id)}
                      />
                      <label
                        htmlFor={`store-${store.id}`}
                        className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {store.name}
                      </label>
                    </div>
                  ))}
                </div>
                {stores.length === 0 && (
                  <p className="text-sm text-muted-foreground">No stores available. Please set up stores first.</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding Product...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Add Product to Selected Stores
                    </>
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setFormData(initialFormData);
                    setBarcodeInput("");
                    setBarcodeResults(null);
                    setUploadedImage(null);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default ProductImport;
