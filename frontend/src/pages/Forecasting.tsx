import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Calendar, Target, Loader2, Package, ShoppingCart } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Bar, BarChart } from "recharts";
import { useState, useEffect } from "react";
import { apiService } from "@/services/api";
import { toast } from "sonner";

interface ProductForecast {
  product: string;
  category: string;
  daily_forecast: number[];
  total_forecast: number;
  current_stock: number;
  recommended_order: number;
  dates: string[];
}

interface ForecastResponse {
  store_id: string;
  forecast_period: string;
  products: ProductForecast[];
  total_revenue_forecast: number;
}

interface Store {
  id: number;
  name: string;
}

const Forecasting = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [forecastDays, setForecastDays] = useState<number>(7);
  const [loading, setLoading] = useState(false);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [productNameMap, setProductNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    loadStores();
    loadProductNames();
  }, []);

  const loadProductNames = async () => {
    try {
      const response = await apiService.getProducts(0, 10000);
      if (response?.products) {
        const nameMap: Record<string, string> = {};
        response.products.forEach((product: any) => {
          if (product._id) {
            nameMap[product._id] = product.name || product.sku || product._id;
          }
          if (product.id) {
            nameMap[product.id] = product.name || product.sku || product.id;
          }
        });
        setProductNameMap(nameMap);
      }
    } catch (error) {
      console.error("Failed to load product names:", error);
    }
  };

  const loadStores = async () => {
    try {
      const response = await apiService.getMyStores();
      if (response?.stores?.length > 0) {
        setStores(response.stores);
        setSelectedStore(response.stores[0].id.toString());
      } else {
        setStores([]);
        toast.error("No stores available. Please add a store.");
      }
    } catch (error) {
      console.error("Failed to load stores:", error);
      setStores([]); // Ensure stores is always an array
      toast.error("Failed to load stores");
    }
  };

  const handleForecast = async () => {
    if (!selectedStore) {
      toast.error("Please select a store");
      return;
    }

    setLoading(true);
    try {
      // Include product_id in the request body (backend requires it)
      const productId = "default-product-id"; // Replace with actual product selection logic
      const response = await apiService.getForecast(selectedStore, forecastDays, productId);
      setForecastData(response);
      setCurrentPage(1); // Reset pagination when new forecast is generated
      toast.success("Forecast generated successfully");
    } catch (error: any) {
      console.error("Failed to generate forecast:", error);
      // Improve error logging in handleForecast
      console.error("API Error Response:", JSON.stringify(error, null, 2));
      toast.error(error.message || "Failed to generate forecast");
    } finally {
      setLoading(false);
    }
  };

  const getProductDisplayName = (product: string): string => {
    // First check if we have a mapping for this product ID
    if (productNameMap[product]) {
      return productNameMap[product];
    }
    // If product is a valid product name (contains alphanumeric and spaces), return it as is
    if (product && product.length < 25 && /^[a-zA-Z0-9\s\-]+$/.test(product)) {
      return product;
    }
    // For IDs, return a truncated version
    return product?.substring(0, 8) + (product?.length > 8 ? '...' : '') || 'Unknown Product';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Electronics": return "bg-blue-500/10 text-blue-500";
      case "Clothing": return "bg-purple-500/10 text-purple-500";
      case "Food": return "bg-green-500/10 text-green-500";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

  const getStockStatus = (current: number, recommended: number) => {
    if (recommended === 0) return { label: "Sufficient", color: "bg-green-500" };
    if (recommended > current * 0.5) return { label: "Low Stock", color: "bg-red-500" };
    return { label: "Moderate", color: "bg-yellow-500" };
  };

  // Prepare chart data with product names
  const chartData = forecastData?.products?.[0]?.dates?.map((date, idx) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ...Object.fromEntries(
      forecastData.products.map(p => [getProductDisplayName(p.product), p.daily_forecast[idx] || 0])
    )
  })) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Render only if stores are loaded */}
        {stores.length > 0 ? (
          <Card className="animate-fade-up">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Sales Forecasting & Inventory Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Store Selection */}
              <div className="grid sm:grid-cols-3 gap-4">
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
                    Forecast Period
                  </label>
                  <Select value={forecastDays.toString()} onValueChange={(v) => setForecastDays(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 Days</SelectItem>
                      <SelectItem value="14">14 Days</SelectItem>
                      <SelectItem value="30">30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={handleForecast}
                    disabled={loading || !selectedStore}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Generate Forecast
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="animate-fade-up">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-accent mx-auto mb-4 flex items-center justify-center">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Stores Available</h3>
              <p className="text-muted-foreground mb-6">
                Please add a store to generate forecasts.
              </p>
            </CardContent>
          </Card>
        )}

        {forecastData && (
          <>
            {/* Summary Cards */}
            <div className="grid sm:grid-cols-3 gap-4">
              <Card className="animate-fade-up">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                      <Target className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Forecast</p>
                      <p className="text-xl font-bold text-foreground">
                        {Math.round(forecastData.products.reduce((sum, p) => sum + p.total_forecast, 0))} units
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="animate-fade-up" style={{ animationDelay: "0.05s" }}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Est. Revenue</p>
                      <p className="text-xl font-bold text-success">
                        {formatCurrency(forecastData.total_revenue_forecast)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Items to Order</p>
                      <p className="text-xl font-bold text-foreground">
                        {forecastData.products.reduce((sum, p) => sum + p.recommended_order, 0)} units
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Forecast Chart */}
            {chartData.length > 0 && (
              <Card className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Daily Sales Forecast - {forecastData.forecast_period}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          {forecastData.products.slice(0, 5).map((product, idx) => (
                            <linearGradient key={product.product} id={`color${idx}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={`hsl(var(--chart-${idx + 1}))`} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={`hsl(var(--chart-${idx + 1}))`} stopOpacity={0} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        {forecastData.products.slice(0, 5).map((product, idx) => (
                          <Area
                            key={product.product}
                            type="monotone"
                            dataKey={getProductDisplayName(product.product)}
                            stroke={`hsl(var(--chart-${idx + 1}))`}
                            fill={`url(#color${idx})`}
                            strokeWidth={2}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Product Recommendations Table */}
            <Card className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Inventory Order Recommendations ({forecastData.products.length} products)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                      <TableHead className="text-right">{forecastDays}-Day Forecast</TableHead>
                      <TableHead className="text-right">Recommended Order</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forecastData.products
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((product, idx) => {
                        const status = getStockStatus(product.current_stock, product.recommended_order);
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {getProductDisplayName(product.product)}
                            </TableCell>
                            <TableCell>
                              <Badge className={getCategoryColor(product.category)} variant="secondary">
                                {product.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{product.current_stock}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {Math.round(product.total_forecast)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={product.recommended_order > 0 ? "text-orange-500 font-semibold" : "text-muted-foreground"}>
                                {product.recommended_order}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="text-xs">
                                <div className={`w-2 h-2 rounded-full ${status.color} mr-1.5`} />
                                {status.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
                
                {/* Pagination Controls */}
                <div className="flex items-center justify-between mt-6 gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Items per page:</label>
                    <select 
                      value={itemsPerPage} 
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 rounded border border-input text-sm"
                    >
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(currentPage * itemsPerPage, forecastData.products.length)} of{" "}
                    {forecastData.products.length} products
                  </div>
                  {forecastData.products.length > itemsPerPage && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded border border-input text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.min(Math.ceil(forecastData.products.length / itemsPerPage), currentPage + 1))}
                        disabled={currentPage === Math.ceil(forecastData.products.length / itemsPerPage)}
                        className="px-3 py-1 rounded border border-input text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!forecastData && !loading && (
          <Card className="animate-fade-up">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-accent mx-auto mb-4 flex items-center justify-center">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Forecast Generated</h3>
              <p className="text-muted-foreground mb-6">
                Select a store and click "Generate Forecast" to see predictions and inventory recommendations.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Forecasting;
