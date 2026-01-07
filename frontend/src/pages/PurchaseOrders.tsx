import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Download, 
  Loader2, 
  Plus, 
  Trash2, 
  ShoppingCart,
  DollarSign,
  Package,
  Calendar
} from "lucide-react";
import { apiService } from "@/services/api";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  payment_terms: string;
}

interface Store {
  id: number;
  name: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  category: string;
  quantity: number;
  unit_price: number;
  description?: string;
}

interface PurchaseOrder {
  po_number: string;
  supplier_info: any;
  store_info: any;
  order_date: string;
  delivery_date: string;
  items: any[];
  subtotal: number;
  shipping_cost: number;
  vat_amount: number;
  total_cost: number;
  payment_terms: string;
  formatted_text: string;
}

const PurchaseOrders = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedPO, setGeneratedPO] = useState<PurchaseOrder | null>(null);

  // Form states for adding items
  const [newItem, setNewItem] = useState({
    product_name: "",
    category: "Electronics",
    quantity: 1,
    unit_price: 0,
    description: ""
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [storesRes, suppliersRes] = await Promise.all([
        apiService.getInventoryStores(),
        apiService.getSuppliers()
      ]);
      setStores(storesRes.stores);
      setSuppliers(suppliersRes.suppliers);
      if (storesRes.stores.length > 0) {
        setSelectedStore(storesRes.stores[0].id.toString());
      }
      if (suppliersRes.suppliers.length > 0) {
        setSelectedSupplier(suppliersRes.suppliers[0].id);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load initial data");
    }
  };

  const addItem = () => {
    if (!newItem.product_name || newItem.quantity <= 0 || newItem.unit_price <= 0) {
      toast.error("Please fill all item fields correctly");
      return;
    }

    const item: OrderItem = {
      id: `item-${Date.now()}`,
      ...newItem
    };

    setItems([...items, item]);
    setNewItem({
      product_name: "",
      category: "Electronics",
      quantity: 1,
      unit_price: 0,
      description: ""
    });
    toast.success("Item added to order");
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
    toast.success("Item removed");
  };

  const handleGeneratePO = async () => {
    if (!selectedStore || !selectedSupplier) {
      toast.error("Please select store and supplier");
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        store_id: parseInt(selectedStore),
        supplier: selectedSupplier,
        items: items.map(({ id, ...item }) => item),
        delivery_date: deliveryDate || undefined,
        notes: notes || undefined
      };

      const po = await apiService.generatePurchaseOrder(orderData);
      setGeneratedPO(po);
      toast.success("Purchase order generated successfully!");
    } catch (error: any) {
      console.error("Failed to generate PO:", error);
      toast.error(error.message || "Failed to generate purchase order");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoGenerate = async () => {
    if (!selectedStore || !selectedSupplier) {
      toast.error("Please select store and supplier");
      return;
    }

    setLoading(true);
    try {
      const po = await apiService.generatePurchaseOrderFromRecommendations(
        selectedStore,
        selectedSupplier,
        notes || "Auto-generiert basierend auf Lagerbestandsempfehlungen"
      );
      setGeneratedPO(po);
      
      // Update items list to show what was ordered
      const autoItems = po.items.map((item: any, idx: number) => ({
        id: `auto-${idx}`,
        product_name: item.product_name,
        category: item.category,
        quantity: item.quantity,
        unit_price: item.unit_price,
        description: item.description
      }));
      setItems(autoItems);
      
      toast.success("Purchase order auto-generated from inventory!");
    } catch (error: any) {
      console.error("Failed to auto-generate PO:", error);
      toast.error(error.message || "Failed to auto-generate purchase order");
    } finally {
      setLoading(false);
    }
  };

  const downloadPO = () => {
    if (!generatedPO) return;

    const blob = new Blob([generatedPO.formatted_text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedPO.po_number}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Purchase order downloaded");
  };

  const resetForm = () => {
    setItems([]);
    setGeneratedPO(null);
    setDeliveryDate("");
    setNotes("");
    toast.info("Form reset");
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const estimatedSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Purchase Order Generator</h1>
            <p className="text-muted-foreground">Erstellen Sie Bestellungen für deutsche Lieferanten</p>
          </div>
          {generatedPO && (
            <Button onClick={downloadPO} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download PO
            </Button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Configuration Card */}
            <Card className="animate-fade-up">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Order Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Store / Filiale</Label>
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map((store) => (
                          <SelectItem key={store.id} value={store.id.toString()}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Supplier / Lieferant</Label>
                    <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Delivery Date / Lieferdatum</Label>
                    <Input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </div>

                  <div className="flex items-end">
                    <Button 
                      onClick={handleAutoGenerate} 
                      disabled={loading}
                      variant="outline"
                      className="w-full"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Auto-Generate from Inventory
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Notes / Anmerkungen</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Zusätzliche Hinweise..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Add Item Card */}
            <Card className="animate-fade-up" style={{ animationDelay: "0.05s" }}>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  Add Items / Artikel hinzufügen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Product Name</Label>
                    <Input
                      value={newItem.product_name}
                      onChange={(e) => setNewItem({ ...newItem, product_name: e.target.value })}
                      placeholder="e.g., Laptop"
                    />
                  </div>

                  <div>
                    <Label>Category</Label>
                    <Select 
                      value={newItem.category} 
                      onValueChange={(v) => setNewItem({ ...newItem, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Electronics">Electronics</SelectItem>
                        <SelectItem value="Clothing">Clothing</SelectItem>
                        <SelectItem value="Food">Food</SelectItem>
                        <SelectItem value="Furniture">Furniture</SelectItem>
                        <SelectItem value="Toys">Toys</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Quantity / Menge</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  <div>
                    <Label>Unit Price / Preis (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newItem.unit_price}
                      onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label>Description (optional)</Label>
                    <Input
                      value={newItem.description}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      placeholder="German description will be auto-generated if empty"
                    />
                  </div>
                </div>

                <Button onClick={addItem} variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item to Order
                </Button>
              </CardContent>
            </Card>

            {/* Items List */}
            {items.length > 0 && (
              <Card className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Order Items ({items.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-accent rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.product_name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {item.category}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {item.quantity} × €{item.unit_price.toFixed(2)} = €{(item.quantity * item.unit_price).toFixed(2)}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Summary & Actions */}
          <div className="space-y-6">
            {/* Summary Card */}
            <Card className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Items</p>
                    <p className="text-xl font-bold">{totalItems}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Est. Subtotal</p>
                    <p className="text-xl font-bold text-success">€{estimatedSubtotal.toFixed(2)}</p>
                  </div>
                </div>

                {generatedPO && (
                  <>
                    <div className="pt-4 border-t space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Shipping:</span>
                        <span>€{generatedPO.shipping_cost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">VAT (19%):</span>
                        <span>€{generatedPO.vat_amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold pt-2 border-t">
                        <span>Total:</span>
                        <span className="text-success">€{generatedPO.total_cost.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">PO Number:</span>
                      </div>
                      <p className="font-mono font-semibold mt-1">{generatedPO.po_number}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={handleGeneratePO}
                disabled={loading || items.length === 0}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Purchase Order
                  </>
                )}
              </Button>

              <Button
                onClick={resetForm}
                variant="outline"
                className="w-full"
              >
                Reset Form
              </Button>
            </div>

            {/* Supplier Info */}
            {selectedSupplier && suppliers.length > 0 && (
              <Card className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Supplier Info</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  {suppliers.find(s => s.id === selectedSupplier) && (
                    <>
                      <div>
                        <span className="text-muted-foreground">Name:</span>
                        <p className="font-medium">{suppliers.find(s => s.id === selectedSupplier)?.name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Payment Terms:</span>
                        <p className="font-medium">{suppliers.find(s => s.id === selectedSupplier)?.payment_terms}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Generated PO Preview */}
        {generatedPO && (
          <Card className="animate-fade-up" style={{ animationDelay: "0.25s" }}>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Generated Purchase Order</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                {generatedPO.formatted_text}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PurchaseOrders;
