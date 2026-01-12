import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package, TrendingUp, AlertTriangle, ShoppingCart, Loader2, PieChart } from "lucide-react";
import { useParams } from "react-router-dom";
import { apiService } from "@/services/api";
import { toast } from "sonner";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface InventoryMetric {
  product: string;
  category: string;
  current_stock: number;
  avg_daily_demand: number;
  demand_std: number;
  reorder_point: number;
  safety_stock: number;
  recommended_order_qty: number;
  abc_classification: string;
  annual_revenue: number;
  stock_days: number;
  status: string;
}

interface OptimizationResponse {
  store_id: string;
  total_products: number;
  metrics: InventoryMetric[];
  abc_summary: {
    A: number;
    B: number;
    C: number;
  };
  total_annual_revenue: number;
}

interface Store {
  id: number;
  name: string;
}

const Inventory = () => {
  const params = useParams();
  const routeStoreId = params.storeId || null;
  const [products, setProducts] = useState<any[]>([]);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(100);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    sku: "",
    name: "",
    stock: "",
    safetyStock: "",
  });
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>(routeStoreId ?? "");
  const [leadTime, setLeadTime] = useState<number>(7);
  const [serviceLevel, setServiceLevel] = useState<number>(0.95);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OptimizationResponse | null>(null);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const response = await apiService.getInventoryStores();
      const storesList = response?.stores ?? [];
      console.debug('loadStores -> storesList:', storesList);
      setStores(storesList);
      // Prefer route store id, then localStorage, otherwise first store
      const lsStore = localStorage.getItem("store_id") || localStorage.getItem("selectedStore");
      let preferred = routeStoreId ?? null;
      if (!preferred && lsStore) {
        try {
          // stored selectedStore might be stringified object
          const parsed = JSON.parse(lsStore);
          preferred = parsed?._id?.toString?.() ?? parsed?.id?.toString?.() ?? lsStore;
        } catch {
          preferred = lsStore;
        }
      }
      if (!preferred && storesList.length > 0) {
        preferred = storesList[0].id?.toString?.() ?? String(storesList[0].id);
      }
      if (preferred) setSelectedStore(preferred);
    } catch (error) {
      console.error("Failed to load stores:", error);
      toast.error("Failed to load stores");
    }
  };

  const handleOptimize = async () => {
    if (!selectedStore) {
      toast.error("Please select a store");
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.getInventoryOptimization(selectedStore, leadTime, serviceLevel);
      setData(response);
      // optimization response contains total_products; use it for pagination
      if (response?.total_products != null) {
        setTotalItems(Number(response.total_products));
        setPage(1);
      }
      toast.success("Inventory optimized successfully");
    } catch (error: any) {
      console.error("Failed to optimize inventory:", error);
      toast.error(error.message || "Failed to optimize inventory");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Critical": return "bg-red-500";
      case "Low - Order Now": return "bg-orange-500";
      case "Moderate": return "bg-yellow-500";
      case "Healthy": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  // Load inventory whenever selectedStore changes
  useEffect(() => {
    const loadInventory = async () => {
      try {
        const storeId = selectedStore || localStorage.getItem("store_id");
        if (!storeId) return;
        const skip = (page - 1) * pageSize;
        const invRes = await apiService.getInventory(storeId, skip, pageSize);
        const items = invRes?.items ?? [];
        const total = invRes?.total ?? items.length;

        const mapped = (items || []).map((it: any) => ({
          sku: it.product_sku || it.product_id,
          name: it.product_name || it.product_id || "Unnamed product",
          stock: Number(it.quantity || 0),
          safetyStock: Number(it.safety_stock ?? it.reorder_point ?? 0),
          status: Number(it.quantity || 0) > Number(it.safety_stock ?? it.reorder_point ?? 0) ? "in-stock" : "low-stock",
        }));
        setProducts(mapped);
        setTotalItems(Number(total || 0));
      } catch (err) {
        console.error("Failed to load inventory:", err);
        setProducts([]);
        setTotalItems(0);
      }
    };

    if (selectedStore) loadInventory();
  }, [selectedStore, page, pageSize]);

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  // When optimization data is available, prefer those metrics in the table.
  // Deduplicate metrics by product id/name to avoid repeated rows from DB
  const rawMetrics = data?.metrics ?? filteredProducts;
  const displayedMetrics = useMemo(() => {
    if (!rawMetrics || rawMetrics.length === 0) return [];
    const map = new Map<string, any>();
    for (const m of rawMetrics) {
      // prefer an explicit product id, fallback to product name
      const key = (m.product_id || m.id || m.sku || m.product || "").toString();
      if (!map.has(key)) {
        map.set(key, m);
      }
    }
    return Array.from(map.values());
  }, [rawMetrics]);
  // paginate the displayed metrics client-side when optimization returns all metrics
  const totalPages = Math.max(1, Math.ceil((data?.total_products ?? totalItems) / pageSize));
  const pagedMetrics = displayedMetrics.slice((page - 1) * pageSize, page * pageSize);
  const getQuantity = (metric: any) => {
    const q = metric?.current_stock ?? metric?.quantity ?? metric?.available_quantity ?? metric?.stock ?? metric?.on_hand ?? metric?.qty ?? 0;
    return Number(q || 0);
  };
  const getABCColor = (classification: string) => {
    switch (classification) {
      case "A": return "bg-emerald-500/10 text-emerald-500";
      case "B": return "bg-blue-500/10 text-blue-500";
      case "C": return "bg-gray-500/10 text-gray-500";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Electronics": return "bg-blue-500/10 text-blue-500";
      case "Clothing": return "bg-purple-500/10 text-purple-500";
      case "Food": return "bg-green-500/10 text-green-500";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

  // Prepare ABC chart data (defensive access)
  const abcChartData = data?.abc_summary ? [
    { name: "A - High Value", value: data.abc_summary.A ?? 0, color: "#10b981" },
    { name: "B - Medium Value", value: data.abc_summary.B ?? 0, color: "#3b82f6" },
    { name: "C - Low Value", value: data.abc_summary.C ?? 0, color: "#6b7280" }
  ] : [];

  // Calculate summary metrics (safe guards)
  const criticalItems = data?.metrics?.filter(m => m.status === "Critical")?.length || 0;
  const needsOrdering = data?.metrics?.filter(m => m.status === "Low - Order Now")?.length || 0;
  const avgStockDays = (data?.metrics && data.metrics.length > 0)
    ? (data.metrics.reduce((sum, m) => sum + (m.stock_days ?? 0), 0) / data.metrics.length).toFixed(1)
    : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleAddProduct = async () => {
    const sel = routeStoreId ? null : localStorage.getItem("selectedStore");
    const storeId = routeStoreId || (sel ? (() => { try { return JSON.parse(sel)._id || JSON.parse(sel).id } catch { return null } })() : null);

    if (!storeId) return;

    const product = {
      sku: newProduct.sku,
      name: newProduct.name,
      stock: parseInt(newProduct.stock),
      safetyStock: parseInt(newProduct.safetyStock),
      store_id: storeId,
      status: parseInt(newProduct.stock) > parseInt(newProduct.safetyStock) ? "in-stock" : "low-stock",
    };

    try {
      const res = await fetch(`http://localhost:8000/api/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });

      if (res.ok) {
        setProducts([...products, product]);
        setNewProduct({ sku: "", name: "", stock: "", safetyStock: "" });
        setIsDialogOpen(false);
      }
    } catch (e) {
      console.error("Failed to add product", e);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">Loading inventory...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header & Controls */}
        <Card className="animate-fade-up">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Inventory Optimization & Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Select Store
                </label>
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Selected store: {selectedStore || 'none'}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Lead Time (days)
                </label>
                <Select value={leadTime.toString()} onValueChange={(v) => setLeadTime(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 Days</SelectItem>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="14">14 Days</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Service Level
                </label>
                <Select value={serviceLevel.toString()} onValueChange={(v) => setServiceLevel(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.90">90%</SelectItem>
                    <SelectItem value="0.95">95%</SelectItem>
                    <SelectItem value="0.99">99%</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleOptimize}
                  disabled={loading || !selectedStore}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Optimize
                    </>
                  )}
                </Button>
              </div>
            </div>
            {/* Pagination controls for inventory list */}
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm">Page size</label>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="border rounded p-1">
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>Prev</Button>
                <div className="text-sm">Page {page} / {totalPages} — {totalItems} items</div>
                <Button variant="outline" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid sm:grid-cols-4 gap-4">
              <Card className="animate-fade-up">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Products</p>
                      <p className="text-xl font-bold text-foreground">{data.total_products}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="animate-fade-up" style={{ animationDelay: "0.05s" }}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Critical Items</p>
                      <p className="text-xl font-bold text-red-500">{criticalItems + needsOrdering}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Annual Revenue</p>
                      <p className="text-xl font-bold text-success">{formatCurrency(data.total_annual_revenue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Stock Days</p>
                      <p className="text-xl font-bold text-foreground">{avgStockDays}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* ABC Analysis Chart */}
              <Card className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-primary" />
                    ABC Classification
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={abcChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name.split(' ')[0]}: ${value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {abcChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">A - High Value:</span>
                      <span className="font-semibold">{data.abc_summary.A} products (80% revenue)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">B - Medium Value:</span>
                      <span className="font-semibold">{data.abc_summary.B} products (15% revenue)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">C - Low Value:</span>
                      <span className="font-semibold">{data.abc_summary.C} products (5% revenue)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Inventory Metrics Table */}
              <Card className="lg:col-span-2 animate-fade-up" style={{ animationDelay: "0.25s" }}>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Inventory Optimization Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>ABC</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">ROP</TableHead>
                          <TableHead className="text-right">Safety Stock</TableHead>
                          <TableHead className="text-right">EOQ</TableHead>
                          <TableHead className="text-right">Days Left</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedMetrics.map((metric, idx) => (
                          <TableRow key={(metric.product || '') + '-' + idx}>
                            <TableCell className="font-medium">{metric.product}</TableCell>
                            <TableCell>
                              <Badge className={getCategoryColor(metric.category)} variant="secondary">
                                {metric.category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getABCColor(metric.abc_classification)} variant="secondary">
                                {metric.abc_classification}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{Number(getQuantity(metric) || 0)}</TableCell>
                            <TableCell className="text-right font-semibold">{metric.reorder_point}</TableCell>
                            <TableCell className="text-right">{metric.safety_stock}</TableCell>
                            <TableCell className="text-right text-primary font-semibold">{metric.recommended_order_qty}</TableCell>
                            <TableCell className="text-right">{(metric.stock_days ?? 0).toFixed(1)}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="text-xs">
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(metric.status)} mr-1.5`} />
                                {metric.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {displayedMetrics.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No products found</p>
            </div>
          ) : pagedMetrics.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No products on this page</p>
            </div>
          ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Legend */}
            <Card className="animate-fade-up" style={{ animationDelay: "0.3s" }}>
              <CardContent className="p-4">
                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-semibold text-foreground">ROP:</span>
                    <span className="text-muted-foreground ml-2">Reorder Point - When to order</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Safety Stock:</span>
                    <span className="text-muted-foreground ml-2">Buffer inventory for uncertainty</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">EOQ:</span>
                    <span className="text-muted-foreground ml-2">Economic Order Quantity - Optimal order size</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Days Left:</span>
                    <span className="text-muted-foreground ml-2">Inventory coverage at current demand</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!data && !loading && (
          <Card className="animate-fade-up">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-accent mx-auto mb-4 flex items-center justify-center">
                <Package className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Optimization Data</h3>
              <p className="text-muted-foreground mb-6">
                Select a store and click "Optimize" to see inventory optimization recommendations.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Inventory;