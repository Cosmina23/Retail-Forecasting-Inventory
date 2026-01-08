import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, TrendingUp, AlertTriangle, ShoppingCart, Loader2, PieChart, Plus } from "lucide-react";
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
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
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
      setStores(response.stores);
      if (response.stores.length > 0) {
        setSelectedStore(response.stores[0].id.toString());
      }
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

  // Prepare ABC chart data
  const abcChartData = data ? [
    { name: "A - High Value", value: data.abc_summary.A, color: "#10b981" },
    { name: "B - Medium Value", value: data.abc_summary.B, color: "#3b82f6" },
    { name: "C - Low Value", value: data.abc_summary.C, color: "#6b7280" }
  ] : [];

  // Calculate summary metrics
  const criticalItems = data?.metrics.filter(m => m.status === "Critical").length || 0;
  const needsOrdering = data?.metrics.filter(m => m.status === "Low - Order Now").length || 0;
  const avgStockDays = data ? (data.metrics.reduce((sum, m) => sum + m.stock_days, 0) / data.metrics.length).toFixed(1) : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Add Products Button */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <Button onClick={() => navigate('/product-import')} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Products
          </Button>
        </div>

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
                        {data.metrics.map((metric, idx) => (
                          <TableRow key={idx}>
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
                            <TableCell className="text-right">{metric.current_stock}</TableCell>
                            <TableCell className="text-right font-semibold">{metric.reorder_point}</TableCell>
                            <TableCell className="text-right">{metric.safety_stock}</TableCell>
                            <TableCell className="text-right text-primary font-semibold">{metric.recommended_order_qty}</TableCell>
                            <TableCell className="text-right">{metric.stock_days.toFixed(1)}</TableCell>
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
