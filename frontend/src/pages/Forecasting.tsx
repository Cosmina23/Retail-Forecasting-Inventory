import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TrendingUp, Calendar, Target, Loader2, Package, ShoppingCart, Search, X, TrendingDown } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Bar, BarChart, Line, LineChart, Legend, ComposedChart } from "recharts";
import { useState, useEffect } from "react";
import { apiService } from "@/services/api";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";

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
  const { t } = useTranslation();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("");
  const [forecastDays, setForecastDays] = useState<number>(7);
  const [loading, setLoading] = useState(false);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [productNameMap, setProductNameMap] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<ProductForecast | null>(null);
  const [productHistory, setProductHistory] = useState<any[]>([]);

  useEffect(() => {
    loadSelectedStore();
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

  const loadSelectedStore = () => {
    try {
      const storeData = localStorage.getItem("selectedStore");
      if (storeData) {
        const store = JSON.parse(storeData);
        setSelectedStore(store.id?.toString() || "");
        setStoreName(store.name || "Selected Store");
      } else {
        toast.error("No store selected. Please select a store first.");
      }
    } catch (error) {
      console.error("Failed to load selected store:", error);
      toast.error("Failed to load selected store");
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
      setSelectedProduct(null); // Reset selected product
      setSearchQuery(""); // Reset search
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

  const handleProductSelect = async (product: ProductForecast) => {
    setSelectedProduct(product);
    
    // Load historical sales data for this product
    try {
      const salesResponse = await apiService.getSales(0, 1000, 30); // Last 30 days
      
      if (salesResponse?.sales) {
        // Filter sales for this specific product
        const productSales = salesResponse.sales.filter((sale: any) => {
          const saleProductId = sale.product_id;
          return saleProductId === product.product || 
                 productNameMap[saleProductId] === product.product ||
                 saleProductId === Object.keys(productNameMap).find(key => productNameMap[key] === product.product);
        });
        
        // Group by date and sum quantities
        const salesByDate: Record<string, number> = {};
        productSales.forEach((sale: any) => {
          const date = new Date(sale.sale_date || sale.created_at).toISOString().split('T')[0];
          salesByDate[date] = (salesByDate[date] || 0) + (sale.quantity || 0);
        });
        
        // Convert to array and sort
        const historyData = Object.entries(salesByDate)
          .map(([date, quantity]) => ({ date, quantity }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        setProductHistory(historyData);
      }
    } catch (error) {
      console.error("Failed to load product history:", error);
      toast.error("Failed to load product history");
    }
  };

  // Filter products based on search query
  const filteredProducts = forecastData?.products.filter(product => {
    const displayName = getProductDisplayName(product.product).toLowerCase();
    const category = product.category.toLowerCase();
    const query = searchQuery.toLowerCase();
    return displayName.includes(query) || category.includes(query);
  }) || [];

  // Prepare chart data with product names
  const chartData = forecastData?.products?.[0]?.dates?.map((date, idx) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ...Object.fromEntries(
      forecastData.products.map(p => [getProductDisplayName(p.product), p.daily_forecast[idx] || 0])
    )
  })) || [];

  // Prepare comparison chart data for selected product
  const comparisonChartData = selectedProduct ? (() => {
    const data: any[] = [];
    
    // Add historical data
    productHistory.forEach(item => {
      data.push({
        date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: item.date,
        actual: item.quantity,
        forecast: null,
        type: 'history'
      });
    });
    
    // Add forecast data
    selectedProduct.dates.forEach((date, idx) => {
      data.push({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date,
        actual: null,
        forecast: selectedProduct.daily_forecast[idx],
        type: 'forecast'
      });
    });
    
    return data.sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
  })() : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Render only if stores are loaded */}
        {selectedStore ? (
          <Card className="animate-fade-up">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Sales Forecasting & Inventory Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Store Selection */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Selected Store
                  </label>
                  <div className="px-3 py-2 border rounded-md bg-muted">
                    {storeName}
                  </div>
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
                        {t('forecasting.generateForecast')}
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
              <h3 className="text-lg font-semibold mb-2">{t('forecasting.noStoreSelected')}</h3>
              <p className="text-muted-foreground mb-6">
                {t('forecasting.selectStoreFirst')}
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
                      <p className="text-sm text-muted-foreground">{t('forecasting.totalForecast')}</p>
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
                      <p className="text-sm text-muted-foreground">{t('forecasting.estimatedRevenue')}</p>
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
                      <p className="text-sm text-muted-foreground">{t('forecasting.itemsToOrder')}</p>
                      <p className="text-xl font-bold text-foreground">
                        {forecastData.products.reduce((sum, p) => sum + p.recommended_order, 0)} units
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Forecast Chart - Collapsed by default, can be expanded */}
            {chartData.length > 0 && (
              <Card className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Daily Sales Forecast - Top 5 Products ({forecastData.forecast_period})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
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
            <Card className="animate-fade-up" style={{ animationDelay: "0.25s" }}>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    {t('forecasting.recommendations')} ({filteredProducts.length} {t('forecasting.product')}s)
                  </CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={t('forecasting.searchProducts')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-9"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('forecasting.product')}</TableHead>
                      <TableHead>{t('forecasting.category')}</TableHead>
                      <TableHead className="text-right">{t('forecasting.currentStock')}</TableHead>
                      <TableHead className="text-right">{forecastDays}-{t('forecasting.days')} {t('forecasting.forecast')}</TableHead>
                      <TableHead className="text-right">{t('forecasting.recommendedOrder')}</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((product, idx) => {
                        const status = getStockStatus(product.current_stock, product.recommended_order);
                        const isSelected = selectedProduct?.product === product.product;
                        return (
                          <TableRow 
                            key={idx}
                            className={`cursor-pointer transition-colors hover:bg-accent/50 ${isSelected ? 'bg-accent' : ''}`}
                            onClick={() => handleProductSelect(product)}
                          >
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
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t('forecasting.showing')} {(currentPage - 1) * itemsPerPage + 1} {t('common.to')}{" "}
                    {Math.min(currentPage * itemsPerPage, filteredProducts.length)} {t('common.of')}{" "}
                    {filteredProducts.length} {t('forecasting.product')}s
                  </div>
                  {filteredProducts.length > itemsPerPage && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded border border-input text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent"
                      >
                        {t('common.previous')}
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.min(Math.ceil(filteredProducts.length / itemsPerPage), currentPage + 1))}
                        disabled={currentPage === Math.ceil(filteredProducts.length / itemsPerPage)}
                        className="px-3 py-1 rounded border border-input text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent"
                      >
                        {t('common.next')}
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Product Comparison Chart - Forecast vs History */}
            {selectedProduct && comparisonChartData.length > 0 && (
              <Card className="animate-fade-up" style={{ animationDelay: "0.25s" }}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      {t('forecasting.productAnalysis')}: {getProductDisplayName(selectedProduct.product)}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedProduct(null);
                        setProductHistory([]);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Comparison of historical sales (last 30 days) vs. {forecastDays}-day forecast
                  </p>
                </CardHeader>
                <CardContent>
                  {/* Product Details Cards */}
                  <div className="grid sm:grid-cols-4 gap-3 mb-6">
                    <div className="p-3 rounded-lg bg-accent">
                      <p className="text-xs text-muted-foreground mb-1">Category</p>
                      <Badge className={getCategoryColor(selectedProduct.category)} variant="secondary">
                        {selectedProduct.category}
                      </Badge>
                    </div>
                    <div className="p-3 rounded-lg bg-accent">
                      <p className="text-xs text-muted-foreground mb-1">Current Stock</p>
                      <p className="text-lg font-bold">{selectedProduct.current_stock}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-accent">
                      <p className="text-xs text-muted-foreground mb-1">{forecastDays}-Day Forecast</p>
                      <p className="text-lg font-bold text-blue-500">{Math.round(selectedProduct.total_forecast)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-accent">
                      <p className="text-xs text-muted-foreground mb-1">Recommended Order</p>
                      <p className={`text-lg font-bold ${selectedProduct.recommended_order > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                        {selectedProduct.recommended_order}
                      </p>
                    </div>
                  </div>

                  {/* Comparison Chart */}
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={comparisonChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }} 
                          stroke="hsl(var(--muted-foreground))"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          formatter={(value: any) => [value ? Math.round(value) : 'N/A', '']}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: '20px' }}
                          iconType="line"
                        />
                        <Area
                          type="monotone"
                          dataKey="actual"
                          name="Historical Sales"
                          stroke="hsl(var(--chart-1))"
                          fill="url(#colorActual)"
                          strokeWidth={2}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="forecast"
                          name="Forecast"
                          stroke="hsl(var(--chart-2))"
                          strokeWidth={3}
                          strokeDasharray="5 5"
                          dot={{ fill: 'hsl(var(--chart-2))', r: 4 }}
                          connectNulls={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Summary Statistics */}
                  <div className="grid sm:grid-cols-3 gap-4 mt-6 pt-6 border-t">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Avg. Daily Sales (History)</p>
                      <p className="text-xl font-bold text-chart-1">
                        {productHistory.length > 0 
                          ? Math.round(productHistory.reduce((sum, item) => sum + item.quantity, 0) / productHistory.length)
                          : 0}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Avg. Daily Forecast</p>
                      <p className="text-xl font-bold text-chart-2">
                        {Math.round(selectedProduct.total_forecast / forecastDays)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Trend</p>
                      <div className="flex items-center justify-center gap-2">
                        {(() => {
                          const avgHistory = productHistory.length > 0 
                            ? productHistory.reduce((sum, item) => sum + item.quantity, 0) / productHistory.length 
                            : 0;
                          const avgForecast = selectedProduct.total_forecast / forecastDays;
                          const trend = avgForecast > avgHistory ? 'up' : 'down';
                          const percentage = avgHistory > 0 
                            ? Math.abs(((avgForecast - avgHistory) / avgHistory) * 100).toFixed(1)
                            : 0;
                          
                          return (
                            <>
                              {trend === 'up' ? (
                                <TrendingUp className="w-5 h-5 text-green-500" />
                              ) : (
                                <TrendingDown className="w-5 h-5 text-red-500" />
                              )}
                              <span className={`text-xl font-bold ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                                {percentage}%
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!forecastData && !loading && (
          <Card className="animate-fade-up">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-accent mx-auto mb-4 flex items-center justify-center">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('forecasting.noForecastGenerated')}</h3>
              <p className="text-muted-foreground mb-6">
                {t('forecasting.selectStoreAndGenerate')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Forecasting;
