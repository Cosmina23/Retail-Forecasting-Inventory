import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { logActivity} from "@/services/activityLogger";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "react-router-dom";
import { 
  FileText, 
  Download, 
  Loader2, 
  Plus, 
  Trash2, 
  ShoppingCart,
  DollarSign,
  Package,
  Calendar,
  FileSpreadsheet,
  FileDown,
  List,
  Search,
  Edit2,
  ArrowUpDown
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { apiService } from "@/services/api";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Supplier {
  id: string;
  name: string;
  payment_terms: string;
  lead_time: number;
}

interface SavedPurchaseOrder extends PurchaseOrder {
  status: 'pending' | 'received';
  created_at: string;
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
  const { t } = useTranslation();
  const params = useParams();
  const routeStoreId = params.storeId || null;
  const [stores, setStores] = useState<Store[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [forecastDays, setForecastDays] = useState<number>(7);
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedPO, setGeneratedPO] = useState<PurchaseOrder | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'excel' | 'pdf' | 'txt'>('excel');
  const location = useLocation();
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategoryDialogOpen, setNewCategoryDialogOpen] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [pendingOrders, setPendingOrders] = useState<SavedPurchaseOrder[]>([]);
  const [receivingOrder, setReceivingOrder] = useState<SavedPurchaseOrder | null>(null);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [allOrders, setAllOrders] = useState<SavedPurchaseOrder[]>([]);
const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Order Items Dialog states
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortAlphabetically, setSortAlphabetically] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [addItemsOpen, setAddItemsOpen] = useState(false);

  // Form states for adding items
  const [newItem, setNewItem] = useState({
    product_name: "",
    category: "Electronics",
    quantity: 1,
    unit_price: 0,
    description: ""
  });

useEffect(() => {
  const loadCategories = async () => {
    if (!selectedStore) return;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`http://localhost:8000/api/purchase-orders/categories/${selectedStore}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Eroare la încărcarea categoriilor:", error);
    }
  };

  loadCategories();
}, [selectedStore]);

useEffect(() => {
  if (selectedSupplier && suppliers.length > 0) {
    const supplier = suppliers.find(s => s.id === selectedSupplier);
    if (supplier) {
      const date = new Date();
      date.setDate(date.getDate() + supplier.lead_time);
      const formattedDate = date.toISOString().split('T')[0];
      setDeliveryDate(formattedDate);
    }
  }
}, [selectedSupplier, suppliers]);

  useEffect(() => {
  if (location.state?.items && items.length === 0) {
    const criticalToOrder = location.state.items.map((item: any) => ({
      id: `crit-${Date.now()}-${item.product_id}`,
      product_name: item.product_name,
      category: item.category || "Electronics",
      // Calculăm o cantitate sugerată (ex: dublul pragului critic sau o valoare fixă)
      quantity:item.reorder_point - item.quantity,
      unit_price: item.unit_price || 0, // Utilizatorul va introduce prețul sau se va lua din DB ulterior
      description: `Critical Restoration - Current Stock: ${item.quantity}`
    }));

    setItems(criticalToOrder);
    toast.success(`${criticalToOrder.length} critical products have been added automatically!`);
  }
}, [location.state]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    // Set store from URL parameter or localStorage
    const sel = routeStoreId ? null : localStorage.getItem("selectedStore");
    const storeId = routeStoreId || (sel ? (() => {
      try {
        return JSON.parse(sel)._id || JSON.parse(sel).id
      } catch {
        return null
      }
    })() : null);

    if (storeId && stores.length > 0) {
      setSelectedStore(storeId);
    }
  }, [routeStoreId, stores]);

const loadAllOrders = async () => {
  if (!selectedStore) return;
  setLoadingHistory(true);
  setHistoryDialogOpen(true);
  try {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`http://localhost:8000/api/purchase-orders/all/${selectedStore}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setAllOrders(data);
    }
  } catch (error) {
    toast.error("Failed to load order history");
  } finally {
    setLoadingHistory(false);
  }
};

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

    // Check if product already exists in items
    const existingItemIndex = items.findIndex(
      item => item.product_name.toLowerCase() === newItem.product_name.toLowerCase()
    );

    if (existingItemIndex !== -1) {
      // Product exists, increase quantity
      const updatedItems = [...items];
      updatedItems[existingItemIndex].quantity += newItem.quantity;
      setItems(updatedItems);
      toast.success(`Increased quantity for "${newItem.product_name}"`);
    } else {
      // New product, add to list
      const item: OrderItem = {
        id: `item-${Date.now()}`,
        ...newItem
      };
      setItems([...items, item]);
      toast.success("Item added to order");
    }

    // Reset form
    setNewItem({
      product_name: "",
      category: "Electronics",
      quantity: 1,
      unit_price: 0,
      description: ""
    });
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
    toast.success("Item removed");
  };

const loadPendingOrders = async (storeId: string) => {
  try {
    const token = localStorage.getItem('access_token');
    // Va trebui să creezi acest endpoint simplu în backend:
    // @router.get("/pending/{store_id}")
    const res = await fetch(`http://localhost:8000/api/purchase-orders/pending/${storeId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setPendingOrders(data);
    }
  } catch (error) {
    console.error("Failed to load pending orders", error);
  }
};

// Apelăm funcția când se schimbă magazinul
useEffect(() => {
  if (selectedStore) {
    loadPendingOrders(selectedStore);
  }
}, [selectedStore]);

const handleConfirmDelivery = async () => {
  if (!receivingOrder) return;

  setLoading(true);
  try {
    const token = localStorage.getItem('access_token');
    const payload = {
      po_number: receivingOrder.po_number,
      items_received: receivingOrder.items.map(item => ({
        product_name: item.product_name,
        received_quantity: receivedQuantities[item.product_name] ?? item.quantity
      }))
    };

    const res = await fetch(`http://localhost:8000/api/purchase-orders/confirm-delivery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      toast.success("Inventory updated successfully!");
      setReceiveDialogOpen(false);
      if (selectedStore) loadPendingOrders(selectedStore); // Refresh listă
    }
  } catch (error) {
    toast.error("Failed to confirm delivery");
  } finally {
    setLoading(false);
  }
};

  const updateItemQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    setItems(items.map(item => 
      item.id === id ? { ...item, quantity } : item
    ));
    setEditingItem(null);
    toast.success("Quantity updated");
  };

  const startEditingItem = (id: string, currentQuantity: number) => {
    setEditingItem(id);
    setEditQuantity(currentQuantity);
    console.log(`Editing item ${id} with quantity ${currentQuantity}`);
  };

  const getFilteredAndSortedItems = () => {
    let filtered = items;
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = items.filter(item => 
        item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply sorting
    if (sortAlphabetically) {
      filtered = [...filtered].sort((a, b) => 
        a.product_name.localeCompare(b.product_name)
      );
    }
    
    return filtered;
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
        store_id: selectedStore,  // Keep as string for MongoDB ObjectId
        supplier: selectedSupplier,
        items: items.map(({ id, ...item }) => item),
        delivery_date: deliveryDate || undefined,
        notes: notes || undefined
      };

      const po = await apiService.generatePurchaseOrder(orderData);
      setGeneratedPO(po);

      // Log the activity
      await logActivity(
        selectedStore,
        "purchase-order_created",
        `Created purchase order ${po.po_number}`,
        {
          po_number: po.po_number,
          supplier: selectedSupplier,
          items_count: items.length,
          total_cost: po.total_cost,
        }
      );

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
      const po = await apiService.generatePurchaseOrderFromForecast(
        selectedStore,
        selectedSupplier,
        notes || "AI-generiert basierend auf Forecast (inkl. Saisonalität & Feiertage)",
        forecastDays
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

      // Log the activity
      await logActivity(
        selectedStore,
        "purchase-order_created",
        `AI-generated purchase order ${po.po_number} from forecast`,
        {
          po_number: po.po_number,
          supplier: selectedSupplier,
          items_count: po.items.length,
          total_cost: po.total_cost,
          auto_generated: true,
          generated_from: "forecast",
        }
      );
      
      toast.success("Purchase order generated from AI forecast!");
    } catch (error: any) {
      console.error("Failed to auto-generate PO:", error);
      toast.error(error.message || "Failed to auto-generate purchase order");
    } finally {
      setLoading(false);
    }
  };

  const downloadPO = () => {
    if (!generatedPO) return;
    setExportDialogOpen(true);
  };

  const exportToExcel = () => {
    if (!generatedPO) return;

    // Prepare data for Excel
    const worksheetData = [
      ['PURCHASE ORDER'],
      ['PO Number:', generatedPO.po_number],
      ['Order Date:', generatedPO.order_date],
      ['Delivery Date:', generatedPO.delivery_date],
      [],
      ['SUPPLIER INFORMATION'],
      ['Name:', generatedPO.supplier_info?.name || ''],
      ['Payment Terms:', generatedPO.payment_terms],
      [],
      ['STORE INFORMATION'],
      ['Name:', generatedPO.store_info?.name || ''],
      [],
      ['ORDER ITEMS'],
      ['Product', 'Quantity', 'Unit Price (€)', 'Total (€)'],
    ];

    // Add items
    generatedPO.items.forEach((item: any) => {
      worksheetData.push([
        item.product_name,
        item.quantity,
        item.unit_price,
        item.quantity * item.unit_price
      ]);
    });

    // Add totals
    worksheetData.push(
      [],
      ['', '', 'Subtotal:', generatedPO.subtotal],
      ['', '', 'Shipping:', generatedPO.shipping_cost],
      ['', '', 'VAT (19%):', generatedPO.vat_amount],
      ['', '', 'TOTAL:', generatedPO.total_cost]
    );

    // Create workbook and worksheet
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Order');

    // Style the header
    ws['!cols'] = [
      { wch: 30 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 }
    ];

    // Download
    XLSX.writeFile(wb, `${generatedPO.po_number}.xlsx`);
    toast.success("Excel file downloaded");
    setExportDialogOpen(false);
  };

  const exportToPDF = () => {
    if (!generatedPO) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('PURCHASE ORDER', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`PO Number: ${generatedPO.po_number}`, 20, 35);
    doc.text(`Order Date: ${generatedPO.order_date}`, 20, 42);
    doc.text(`Delivery Date: ${generatedPO.delivery_date}`, 20, 49);

    // Supplier Info
    doc.setFontSize(12);
    doc.text('SUPPLIER INFORMATION', 20, 62);
    doc.setFontSize(10);
    doc.text(`Name: ${generatedPO.supplier_info?.name || ''}`, 20, 69);
    doc.text(`Payment Terms: ${generatedPO.payment_terms}`, 20, 76);

    // Store Info
    doc.setFontSize(12);
    doc.text('STORE INFORMATION', 120, 62);
    doc.setFontSize(10);
    doc.text(`Name: ${generatedPO.store_info?.name || ''}`, 120, 69);

    // Items table
    const tableData = generatedPO.items.map((item: any) => [
      item.product_name,
      item.quantity.toString(),
      `€${item.unit_price.toFixed(2)}`,
      `€${(item.quantity * item.unit_price).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 90,
      head: [['Product', 'Qty', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202] },
      styles: { fontSize: 9 }
    });

    // Totals - get final Y position from autoTable
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Subtotal: €${generatedPO.subtotal.toFixed(2)}`, 140, finalY);
    doc.text(`Shipping: €${generatedPO.shipping_cost.toFixed(2)}`, 140, finalY + 7);
    doc.text(`VAT (19%): €${generatedPO.vat_amount.toFixed(2)}`, 140, finalY + 14);
    doc.setFontSize(12);
    doc.text(`TOTAL: €${generatedPO.total_cost.toFixed(2)}`, 140, finalY + 24);

    // Download
    doc.save(`${generatedPO.po_number}.pdf`);
    toast.success("PDF file downloaded");
    setExportDialogOpen(false);
  };

  const exportToText = () => {
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
    toast.success("Text file downloaded");
    setExportDialogOpen(false);
  };

  const handleExport = () => {
    switch (selectedFormat) {
      case 'excel':
        exportToExcel();
        break;
      case 'pdf':
        exportToPDF();
        break;
      case 'txt':
        exportToText();
        break;
    }
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
            <h1 className="text-2xl font-bold">{t('purchaseOrders.title')}</h1>
            <p className="text-muted-foreground">{t('purchaseOrders.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadAllOrders} variant="outline" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              {t('purchaseOrders.viewAllOrders')}
            </Button>
            {generatedPO && (
              <Button onClick={downloadPO} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                {t('purchaseOrders.downloadPO')}
              </Button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 space-y-6">

            {/* Configuration Card */}
            <Card className="animate-fade-up">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  {t('purchaseOrders.orderConfiguration')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('purchaseOrders.store')}</Label>
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
                    <Label>{t('purchaseOrders.supplier')}</Label>
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
                    <Label>{t('purchaseOrders.forecastPeriod')}</Label>
                    <Select value={forecastDays.toString()} onValueChange={(value) => setForecastDays(Number(value))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 {t('forecasting.days')}</SelectItem>
                        <SelectItem value="14">14 {t('forecasting.days')}</SelectItem>
                        <SelectItem value="30">30 {t('forecasting.days')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>📊 Info:</strong> {t('purchaseOrders.makeSureForecast', { days: forecastDays })}
                  </p>
                </div>

                <Button 
                  onClick={handleAutoGenerate} 
                  disabled={loading}
                  variant="default"
                  className="w-full"
                  size="lg"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {t('purchaseOrders.generateFromForecast')}
                </Button>

                <div>
                  <Label>{t('purchaseOrders.notes')}</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Zusätzliche Hinweise..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Add Item Card - Collapsible */}
            <Collapsible open={addItemsOpen} onOpenChange={setAddItemsOpen}>
              <Card className="animate-fade-up" style={{ animationDelay: "0.05s" }}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
                    <CardTitle className="text-base font-semibold flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Plus className="w-5 h-5 text-primary" />
                        Add Items / Artikel hinzufügen
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${addItemsOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </Button>
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Product Name</Label>
                        <Input
                          value={newItem.product_name}
                          onChange={(e) => setNewItem({ ...newItem, product_name: e.target.value })}
                          placeholder="e.g., Item"
                        />
                      </div>

                      <div className="space-y-2">
                      <Label>Category</Label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Select
                            value={newItem.category}
                            onValueChange={(v) => setNewItem({ ...newItem, category: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setNewCategoryDialogOpen(true)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
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
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* View Order Items Button */}
            {items.length > 0 && (
              <Card className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
                <CardContent className="pt-6">
                  <Button 
                    onClick={() => setOrderDialogOpen(true)} 
                    variant="outline" 
                    className="w-full"
                  >
                    <List className="w-4 h-4 mr-2" />
                    View Order Items ({items.length})
                  </Button>
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
                  {(() => {
                    const s = suppliers.find(sup => sup.id === selectedSupplier);
                    return s ? (
                      <>
                        <div>
                          <span className="text-muted-foreground">Name:</span>
                          <p className="font-medium">{s.name}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Lead Time:</span>
                          <p className="font-medium text-blue-600">{s.lead_time} days</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Payment Terms:</span>
                          <p className="font-medium">{s.payment_terms}</p>
                        </div>
                      </>
                    ) : null;
                  })()}
                </CardContent>
              </Card>
            )}
        <Card className="mt-8 border-blue-100 bg-blue-50/30">
  <CardHeader>
    <CardTitle className="text-lg flex items-center gap-2">
      <Package className="w-5 h-5 text-blue-600" />
      Active Orders (Awaiting Delivery)
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {pendingOrders.length === 0 ? (
        <p className="text-center py-4 text-muted-foreground italic">No orders currently in transit.</p>
      ) : (
        pendingOrders.map(po => (
          <div key={po.po_number} className="flex items-center justify-between p-4 bg-white rounded-xl border shadow-sm">
            <div>
              <p className="font-bold">{po.po_number}</p>
              <p className="text-xs text-muted-foreground">
                {po.supplier_info.name} • Est. Delivery: {po.delivery_date}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setReceivingOrder(po);
                setReceiveDialogOpen(true);
              }}
            >
              Receive Goods
            </Button>
          </div>
        ))
      )}
    </div>
  </CardContent>
</Card>


          </div>
        </div>

        {/* Order Items Dialog */}
        <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Order Items ({items.length})</DialogTitle>
              <DialogDescription>
                Manage your order items - search, sort, edit quantities, or remove items
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              {/* Search and Sort Controls */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by product name or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant={sortAlphabetically ? "default" : "outline"}
                  size="icon"
                  onClick={() => setSortAlphabetically(!sortAlphabetically)}
                  title={sortAlphabetically ? "Disable alphabetical sort" : "Sort alphabetically"}
                >
                  <ArrowUpDown className="w-4 h-4" />
                </Button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {getFilteredAndSortedItems().length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No items match your search" : "No items in order"}
                  </div>
                ) : (
                  getFilteredAndSortedItems().map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-4 bg-accent rounded-lg hover:bg-accent/80 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{item.product_name}</span>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {item.category}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          €{item.unit_price.toFixed(2)} per unit
                        </div>
                      </div>
                      
                      {/* Quantity Section */}
                      <div className="flex items-center gap-2">
                        {editingItem === item.id ? (
                          <>
                            <Input
                              key={`edit-${item.id}-${item.quantity}`}
                              type="number"
                              min="1"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                              className="w-20"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateItemQuantity(item.id, editQuantity);
                                } else if (e.key === 'Escape') {
                                  setEditingItem(null);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => updateItemQuantity(item.id, editQuantity)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingItem(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="text-right min-w-[80px]">
                              <div className="font-semibold">Qty: {item.quantity}</div>
                              <div className="text-sm text-success">
                                €{(item.quantity * item.unit_price).toFixed(2)}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditingItem(item.id, item.quantity)}
                              title="Edit quantity"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(item.id)}
                              className="text-destructive hover:text-destructive"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Summary Footer */}
              {items.length > 0 && (
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Items:</span>
                    <span className="font-semibold">{totalItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated Subtotal:</span>
                    <span className="font-bold text-success text-lg">
                      €{estimatedSubtotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setOrderDialogOpen(false);
                setSearchQuery("");
                setEditingItem(null);
              }}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Export Purchase Order</DialogTitle>
              <DialogDescription>
                Choose the format for exporting your purchase order
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-3">
                <button
                  onClick={() => setSelectedFormat('excel')}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    selectedFormat === 'excel'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold">Excel (.xlsx)</p>
                    <p className="text-sm text-muted-foreground">Editable spreadsheet format</p>
                  </div>
                  {selectedFormat === 'excel' && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setSelectedFormat('pdf')}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    selectedFormat === 'pdf'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <FileDown className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold">PDF (.pdf)</p>
                    <p className="text-sm text-muted-foreground">Professional document format</p>
                  </div>
                  {selectedFormat === 'pdf' && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setSelectedFormat('txt')}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    selectedFormat === 'txt'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold">Text (.txt)</p>
                    <p className="text-sm text-muted-foreground">Plain text format</p>
                  </div>
                  {selectedFormat === 'txt' && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              </div>
            </div>
            <DialogFooter className="sm:justify-between">
              <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export {selectedFormat.toUpperCase()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={newCategoryDialogOpen} onOpenChange={setNewCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Category</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Category name..."
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
            />
            <DialogFooter>
              <Button onClick={() => {
                if (customCategory && !categories.includes(customCategory)) {
                  setCategories([...categories, customCategory].sort());
                  setNewItem({ ...newItem, category: customCategory });
                  setCustomCategory("");
                  setNewCategoryDialogOpen(false);
                }
              }}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
  <DialogContent className="sm:max-w-2xl">
    <DialogHeader>
      <DialogTitle>Confirm Goods Receipt: {receivingOrder?.po_number}</DialogTitle>
      <DialogDescription>Enter the quantities received for each product.</DialogDescription>
    </DialogHeader>

    <div className="space-y-4 my-4 max-h-[50vh] overflow-y-auto">
      {receivingOrder?.items.map(item => (
        <div key={item.product_name} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex-1">
            <p className="font-medium">{item.product_name}</p>
            <p className="text-xs text-muted-foreground">Ordered: {item.quantity}</p>
          </div>
          <div className="w-32">
            <Label className="text-[10px]">Quantity Received</Label>
            <Input
              type="number"
              defaultValue={item.quantity}
              onChange={(e) => setReceivedQuantities({
                ...receivedQuantities,
                [item.product_name]: parseInt(e.target.value) || 0
              })}
            />
          </div>
        </div>
      ))}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>Cancel</Button>
      <Button onClick={handleConfirmDelivery} disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Confirm and Update Stock
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
  <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
    <DialogHeader>
      <DialogTitle>Complete Order History</DialogTitle>
      <DialogDescription>View all pending and finalized purchase orders.</DialogDescription>
    </DialogHeader>

    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
      {loadingHistory ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
      ) : allOrders.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground italic">No orders found.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-3 text-left">PO Number</th>
                <th className="p-3 text-left">Supplier</th>
                <th className="p-3 text-left">Total Cost</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Delivery Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {allOrders.map((order) => (
                <tr key={order.po_number} className="hover:bg-slate-50/50">
                  <td className="p-3 font-mono font-medium">{order.po_number}</td>
                  <td className="p-3">{order.supplier_info.name}</td>
                  <td className="p-3 font-semibold">€{order.total_cost.toFixed(2)}</td>
                  <td className="p-3">
                    <Badge className={
                      order.status === 'received'
                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                      : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                    }>
                      {order.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{order.delivery_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </DialogContent>
</Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PurchaseOrders;
