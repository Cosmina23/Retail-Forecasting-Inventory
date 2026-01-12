import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Package, ShoppingCart, Euro, AlertTriangle } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Chatbot } from '@/components/Chatbot';
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

interface SalePoint {
  date: string;
  forecast?: number | null;
  actual?: number | null;
}

interface InventoryEntry {
  name?: string;
  product_id?: string;
  value?: number;
  quantity?: number;
  reorder_level?: number;
  color?: string;
}

interface StatItem {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: any;
}

const Dashboard = () => {
  const params = useParams();
  const routeStoreId = params.storeId || null;
  const [salesData, setSalesData] = useState<SalePoint[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryEntry[]>([]);
  const [stats, setStats] = useState<StatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  useEffect(() => {
    const sel = routeStoreId ? null : localStorage.getItem("selectedStore");
    let storeId = routeStoreId;

    if (!storeId && sel) {
      try {
        const store = JSON.parse(sel);
        storeId = store.store_id || store.id || store._id;
      } catch {
        storeId = null;
      }
    }

    if (!storeId) {
      setLoading(false);
      setError("No store selected. Please select a store from the shop selector.");
      return;
    }

    fetchDataForStore(storeId);
  }, [routeStoreId]);

  const fetchDataForStore = async (storeId: string) => {
    setLoading(true);
    setError(null);

    try {
      const base = "http://localhost:8000/api";

      // Get auth token and add to headers
      const token = localStorage.getItem('access_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 1. Get store details first
      const storeRes = await fetch(`${base}/stores/${storeId}`, { headers });
      if (!storeRes.ok) {
        setError(storeRes.status === 404 ? "Store not found." : "Failed to connect to server.");
        setLoading(false);
        return;
      }

      const storeData = await storeRes.json();
      console.log("🏪 Store data received:", storeData);

      // Use the store's _id (which is returned as 'id') for all queries
      const queryStoreId = storeData.id || storeId;
      console.log("📍 Using ID for data queries:", queryStoreId);

      // 2. Incarcare date
      let sales: SalePoint[] = [];
      let inventory: InventoryEntry[] = [];
      let metrics: any = null;

      try {
        const [sfRes, iRes, mRes] = await Promise.all([
          fetch(`${base}/stores/${storeId}/sales-forecast`, { headers }),
          fetch(`${base}/inventory?store_id=${queryStoreId}`, { headers }),
          fetch(`${base}/stores/${storeId}/metrics`, { headers })
        ]);

        console.log("📊 Sales-Forecast Response:", sfRes.status, sfRes.statusText);
        console.log("📦 Inventory Response:", iRes.status, iRes.statusText);
        console.log("📈 Metrics Response:", mRes.status, mRes.statusText);

        if (sfRes.ok) {
          const salesForecastData = await sfRes.json();
          console.log("📊 Sales-Forecast Data:", salesForecastData);
          if (Array.isArray(salesForecastData) && salesForecastData.length > 0) {
            sales = salesForecastData;
          } else {
            console.warn("⚠️ No sales-forecast data returned or empty array");
          }
        } else {
          console.error("❌ Sales-Forecast API error:", sfRes.status, await sfRes.text());
        }

        if (iRes.ok) {
          const rawInventory = await iRes.json();
          console.log("📦 Inventory Data:", rawInventory);
          // Transform inventory data for pie chart
          if (Array.isArray(rawInventory) && rawInventory.length > 0) {
            const categoryData = rawInventory.reduce((acc: any, item: any) => {
              const category = item.category || 'Other';
              if (!acc[category]) {
                acc[category] = { name: category, value: 0 };
              }
              acc[category].value += item.stock_quantity || 0;
              return acc;
            }, {});

            // Calculate total and convert to percentages
            const total = Object.values(categoryData).reduce((sum: number, item: any) => sum + item.value, 0);
            inventory = Object.values(categoryData).map((item: any, index: number) => ({
              name: item.name,
              value: Math.round((item.value / total) * 100),
              color: `hsl(var(--chart-${(index % 5) + 1}))`
            }));
          } else {
            console.warn("⚠️ No inventory data returned or empty array");
          }
        } else {
          console.error("❌ Inventory API error:", await iRes.text());
        }

        if (mRes.ok) {
          metrics = await mRes.json();
          console.log("📈 Metrics Data:", metrics);
        } else {
          console.warn("⚠️ Metrics not available:", mRes.status, await mRes.text());
        }
      } catch (e) {
        console.error("❌ Error loading data:", e);
      }

      setSalesData(sales.length ? sales : fallbackSales());
      setInventoryData(inventory.length ? inventory : fallbackInventory());

      const computedStats: StatItem[] = [];

      if (metrics) {
        computedStats.push({
          label: "Daily Revenue",
          value: formatCurrency(metrics.daily_revenue ?? 0),
          change: metrics.revenue_change ? `${metrics.revenue_change}%` : "",
          positive: (metrics.revenue_change || 0) >= 0,
          icon: Euro,
        });
        computedStats.push({
          label: "Orders",
          value: String(metrics.orders ?? 0),
          change: metrics.orders_change ? `${metrics.orders_change}%` : "",
          positive: (metrics.orders_change || 0) >= 0,
          icon: ShoppingCart,
        });
        computedStats.push({
          label: "Stock Level",
          value: String(metrics.stock_level ?? 0),
          change: metrics.stock_change ? `${metrics.stock_change}%` : "",
          positive: true,
          icon: Package,
        });
        computedStats.push({
          label: "Critical Items",
          value: String(metrics.critical_items ?? 0),
          change: metrics.critical_items_change ? `${metrics.critical_items_change}%` : "",
          positive: (metrics.critical_items_change || 0) <= 0,
          icon: AlertTriangle,
        });
      } else {
        const revenue = sales.reduce((acc, s) => acc + (s.actual || 0), 0);
        const stock = inventory.reduce((acc, i) => acc + (i.quantity || 0), 0);
        const critical = inventory.reduce((acc, i) => acc + ((i.quantity ?? 0) <= (i.reorder_level ?? 0) ? 1 : 0), 0);

        computedStats.push({ label: "Daily Revenue", value: formatCurrency(revenue), icon: Euro, positive: true });
        computedStats.push({ label: "Orders", value: String(sales.length), icon: ShoppingCart, positive: true });
        computedStats.push({ label: "Stock Level", value: String(stock), icon: Package, positive: true });
        computedStats.push({ label: "Critical Items", value: String(critical), icon: AlertTriangle, positive: critical === 0 });
      }

      setStats(computedStats);
    } catch (e) {
      console.error("Dashboard Fetch Error:", e);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  const fallbackSales = (): SalePoint[] => [{ date: "No data", forecast: 0, actual: 0 }];
  const fallbackInventory = (): InventoryEntry[] => [{ name: "No data", value: 100, color: "hsl(var(--chart-3))" }];

  if (loading) return <DashboardLayout><div className="min-h-screen flex items-center justify-center">Loading...</div></DashboardLayout>;
  if (error) return <DashboardLayout><div className="min-h-screen flex items-center justify-center text-red-500">{error}</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="animate-fade-up">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  {stat.change && (
                    <div className={`flex items-center gap-1 text-sm ${stat.positive ? "text-success" : "text-destructive"}`}>
                      {stat.positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {stat.change}
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base font-semibold">Sales Forecast vs History</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(v) => `€${v}`} />
                    <Tooltip />
                    <Area type="monotone" dataKey="forecast" stroke="hsl(var(--chart-1))" fillOpacity={0.1} fill="hsl(var(--chart-1))" name="Forecast" />
                    <Area type="monotone" dataKey="actual" stroke="hsl(var(--chart-2))" fillOpacity={0.1} fill="hsl(var(--chart-2))" name="Actual" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Inventory Composition</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={inventoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                      {inventoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || `hsl(var(--chart-${(index % 5) + 1}))`} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Chatbot storeId={routeStoreId || ""} />
    </DashboardLayout>
  );
};

export default Dashboard;

