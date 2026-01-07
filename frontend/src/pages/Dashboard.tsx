import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Package, ShoppingCart, Euro, AlertTriangle } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Chatbot} from '@/components/Chatbot';
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
    const storeId = routeStoreId || (sel ? (() => { try { return JSON.parse(sel)._id || JSON.parse(sel).id } catch { return null } })() : null);

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

    console.log('🔍 Fetching data for store:', storeId);

    try {
      const base = "http://localhost:8000/api";

      // Verificăm mai întâi că store-ul există
      try {
        console.log('📡 Checking if store exists...');
        const storeRes = await fetch(`${base}/stores/${storeId}`);
        if (!storeRes.ok) {
          if (storeRes.status === 404) {
            console.error('❌ Store not found');
            setError(`Store with ID "${storeId}" not found. Please select a valid store.`);
            setLoading(false);
            return;
          }
          throw new Error(`Failed to fetch store: ${storeRes.statusText}`);
        }
        const storeData = await storeRes.json();
        console.log('✅ Store found:', storeData);
      } catch (e) {
        console.error("❌ Store validation failed", e);
        setError(`Unable to access store "${storeId}". The store may not exist or the server is unavailable.`);
        setLoading(false);
        return;
      }

      let sales: SalePoint[] = [];
      try {
        console.log('📡 Fetching sales...');
        const res = await fetch(`${base}/sales?store_id=${storeId}`);
        if (res.ok) {
          sales = await res.json();
          console.log('✅ Sales loaded:', sales.length, 'items');
        }
      } catch (e) {
        console.debug("⚠️ sales endpoint not available", e);
      }

      let inventory: InventoryEntry[] = [];
      try {
        console.log('📡 Fetching inventory...');
        const res = await fetch(`${base}/inventory?store_id=${storeId}`);
        if (res.ok) {
          inventory = await res.json();
          console.log('✅ Inventory loaded:', inventory.length, 'items');
        }
      } catch (e) {
        console.debug("⚠️ inventory endpoint not available", e);
      }

      let metrics: any = null;
      try {
        console.log('📡 Fetching metrics...');
        const res = await fetch(`${base}/stores/${storeId}/metrics`);
        if (res.ok) {
          metrics = await res.json();
          console.log('✅ Metrics loaded:', metrics);
        }
      } catch (e) {
        console.debug("⚠️ metrics endpoint optional", e);
      }

      console.log('📊 Setting up dashboard data...');
      setSalesData(sales.length ? sales : fallbackSales());
      setInventoryData(inventory.length ? inventory : fallbackInventory());

      const computedStats: StatItem[] = [];

      if (metrics) {
        computedStats.push({
          label: "Daily Revenue",
          value: formatCurrency(metrics.daily_revenue ?? 0),
          change: metrics.revenue_change ? `${metrics.revenue_change}` : "",
          positive: (metrics.revenue_change || 0) >= 0,
          icon: Euro,
        });

        computedStats.push({
          label: "Orders",
          value: String(metrics.orders ?? 0),
          change: metrics.orders_change ? `${metrics.orders_change}` : "",
          positive: (metrics.orders_change || 0) >= 0,
          icon: ShoppingCart,
        });

        computedStats.push({
          label: "Stock Level",
          value: String(metrics.stock_level ?? 0),
          change: metrics.stock_change ? `${metrics.stock_change}` : "",
          positive: (metrics.stock_change || 0) >= 0,
          icon: Package,
        });

        computedStats.push({
          label: "Critical Items",
          value: String(metrics.critical_items ?? 0),
          change: metrics.critical_items_change ? `${metrics.critical_items_change}` : "",
          positive: (metrics.critical_items_change || 0) <= 0,
          icon: AlertTriangle,
        });
      } else {
        const orders = sales.length;
        const stockLevel = inventory.reduce((acc, i) => acc + (i.quantity || 0), 0);
        const critical = inventory.reduce((acc, i) => acc + ((i.quantity ?? 0) <= (i.reorder_level ?? 0) ? 1 : 0), 0);
        const revenue = sales.reduce((acc, s) => acc + (typeof s.actual === 'number' ? s.actual : 0), 0);

        computedStats.push({ label: "Daily Revenue", value: formatCurrency(revenue), change: "", positive: true, icon: Euro });
        computedStats.push({ label: "Orders", value: String(orders), change: "", positive: true, icon: ShoppingCart });
        computedStats.push({ label: "Stock Level", value: String(stockLevel), change: "", positive: true, icon: Package });
        computedStats.push({ label: "Critical Items", value: String(critical), change: "", positive: critical === 0, icon: AlertTriangle });
      }

      setStats(computedStats);
    } catch (e) {
      console.error("Failed to fetch dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  const fallbackSales = (): SalePoint[] => {
    return [
      { date: "Day 1", forecast: 0, actual: 0 },
      { date: "Day 2", forecast: 0, actual: 0 },
      { date: "Day 3", forecast: 0, actual: 0 },
    ];
  };

  const fallbackInventory = (): InventoryEntry[] => {
    return [
      { name: "No data", value: 100, color: "hsl(var(--chart-3))" },
    ];
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">Loading dashboard...</div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-center text-red-500">{error}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={stat.label} className="animate-fade-up" style={{ animationDelay: `${index * 0.05}s` }}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${stat.positive ? "text-success" : "text-destructive"}`}>
                    {stat.positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {stat.change}
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Area Chart */}
          <Card className="lg:col-span-2 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Sales Forecast vs History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tickFormatter={(v) => `€${v / 1000}k`} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Area
                      type="monotone"
                      dataKey="forecast"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorForecast)"
                      name="Forecast"
                    />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorActual)"
                      name="Actual"
                      connectNulls={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                  <span className="text-sm text-muted-foreground">Forecast</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
                  <span className="text-sm text-muted-foreground">Actual</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card className="animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Inventory Composition</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inventoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {inventoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => `${value}%`}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
                    />
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
