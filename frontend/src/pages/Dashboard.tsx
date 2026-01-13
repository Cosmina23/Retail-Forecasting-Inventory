import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  Package,
  ShoppingCart,
  Euro,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { Chatbot } from '@/components/Chatbot';
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

// --- INTERFEȚE DATE ---
interface SalePoint {
  date: string;
  forecast: number;
  actual: number;
}

interface CategoryStat {
  name: string;
  amount: number;
  percentage: number;
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

  // --- STATE-URI LOGICĂ ---
  const [weekOffset, setWeekOffset] = useState(0);
  const [maxOffset, setMaxOffset] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // --- STATE-URI DATE ---
  const [salesData, setSalesData] = useState<SalePoint[]>([]);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [topCategories, setTopCategories] = useState<CategoryStat[]>([]);
  const [stats, setStats] = useState<StatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const fallbackSales = (): SalePoint[] => [{ date: "N/A", forecast: 0, actual: 0 }];

  // Efect pentru încărcarea datelor la schimbarea magazinului, offset-ului sau categoriei
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
      setError("No store selected. Please select one from the sidebar.");
      return;
    }

    fetchData(storeId, weekOffset, selectedCategory);
  }, [routeStoreId, weekOffset, selectedCategory]);

  const fetchData = async (id: string, offset: number, category: string | null) => {
    setLoading(true);
    try {
      const base = "http://localhost:8000/api";
      const token = localStorage.getItem('access_token');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Construim URL-ul pentru forecast cu filtrul de categorie
      const forecastUrl = `${base}/stores/${id}/sales-forecast?offset=${offset}${category ? `&category=${encodeURIComponent(category)}` : ''}`;

      const [sfRes, iRes, mRes] = await Promise.all([
        fetch(forecastUrl, { headers }),
        fetch(`${base}/inventory?store_id=${id}`, { headers }),
        fetch(`${base}/stores/${id}/metrics?offset=${offset}`, { headers })
      ]);

      // 1. Procesare Forecast & History
      if (sfRes.ok) {
        const data = await sfRes.json();
        setSalesData(data.length ? data : fallbackSales());
      }

      // 2. Procesare Metrics & Categories
      if (mRes.ok) {
        const m = await mRes.json();
        setMaxOffset(m.max_offset || 0);
        setTopCategories(m.top_categories || []);

        setStats([
          {
            label: offset === 0 ? "Weekly Revenue" : "Revenue (Historical)",
            value: formatCurrency(m.weekly_revenue ?? 0),
            change: m.revenue_change ? `${m.revenue_change}%` : "0%",
            positive: (m.revenue_change || 0) >= 0,
            icon: Euro,
          },
          {
            label: offset === 0 ? "Weekly Orders" : "Orders (Historical)",
            value: String(m.orders ?? 0),
            change: m.orders_change ? `${m.orders_change}%` : "0%",
            positive: (m.orders_change || 0) >= 0,
            icon: ShoppingCart,
          },
          {
            label: "Stock Level",
            value: String(m.stock_level ?? 0),
            positive: true,
            icon: Package,
          },
          {
            label: "Critical Items",
            value: String(m.critical_items ?? 0),
            positive: (m.critical_items || 0) === 0,
            icon: AlertTriangle,
          }
        ]);
      }

      // 3. Procesare Inventory Pie Chart
      if (iRes.ok) {
        const inv = await iRes.json();
        const cats = inv.reduce((acc: any, item: any) => {
          const c = item.category || 'Other';
          acc[c] = (acc[c] || 0) + (item.stock_quantity || 0);
          return acc;
        }, {});

        setInventoryData(Object.keys(cats).map((name, i) => ({
          name,
          value: cats[name],
          color: `hsl(var(--chart-${(i % 5) + 1}))`
        })));
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !salesData.length) {
    return (
      <DashboardLayout>
        <div className="h-screen flex items-center justify-center animate-pulse text-primary font-bold text-xl italic">
          Igniting Engines... 🚀
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 p-2 pb-10 animate-in fade-in duration-700">

        {/* --- HEADER & NAVIGARE --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-blue-600 to-indigo-400 bg-clip-text text-transparent italic">
              Executive Overview
            </h1>
            <p className="text-muted-foreground font-medium">
              {weekOffset === 0 ? "Your weekly performance analysis." : `Historical data from ${weekOffset} week(s) ago.`}
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset(p => p + 1)}
              disabled={weekOffset >= maxOffset}
              className="rounded-xl hover:bg-white transition-all disabled:opacity-20"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </Button>

            <Button
              variant="ghost"
              onClick={() => setWeekOffset(0)}
              className="flex items-center gap-2 px-4 py-1 font-bold text-sm text-slate-700 group hover:bg-white rounded-xl transition-all"
              title="Reset to current week"
            >
              <Calendar className={`w-4 h-4 transition-colors ${weekOffset === 0 ? "text-blue-500" : "text-slate-400 group-hover:text-blue-500"}`} />
              <span className="min-w-[100px] text-center">
                {weekOffset === 0 ? "Current Week" : `${weekOffset} Weeks Ago`}
              </span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset(p => Math.max(0, p - 1))}
              disabled={weekOffset === 0}
              className="rounded-xl hover:bg-white transition-all disabled:opacity-20"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </Button>
          </div>
        </div>

        {/* --- STATS GRID --- */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((s) => (
            <Card key={s.label} className="group relative overflow-hidden border-none shadow-md hover:shadow-2xl transition-all duration-300 bg-white/60 backdrop-blur-md hover:-translate-y-1">
              <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <s.icon size={120} />
              </div>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-2xl ${s.positive ? "bg-emerald-50 text-emerald-600 shadow-inner" : "bg-rose-50 text-rose-600 shadow-inner"}`}>
                    <s.icon className="w-6 h-6" />
                  </div>
                  {s.change && (
                    <div className={`text-xs font-bold px-2 py-1 rounded-full ${s.positive ? "bg-emerald-100/50 text-emerald-700" : "bg-rose-100/50 text-rose-700"}`}>
                      {s.change}
                    </div>
                  )}
                </div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{s.value}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* --- CHARTS ROW --- */}
        <div className="grid lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 shadow-xl border-none bg-white/80 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <TrendingUp className="text-blue-500 w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold tracking-tight">Sales Analysis</CardTitle>
                  {selectedCategory ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full uppercase tracking-tighter">
                        Category: {selectedCategory}
                      </span>
                      <button onClick={() => setSelectedCategory(null)} className="text-slate-300 hover:text-rose-500 transition-colors">
                        <XCircle size={14} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Comparing actual sales vs AI forecast</p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData}>
                    <defs>
                      <linearGradient id="cActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} tickFormatter={(v) => `€${v}`} />
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'}} />
                    <Area type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={4} fill="url(#cActual)" name="Actual Sales" />
                    <Area type="monotone" dataKey="forecast" stroke="#10b981" strokeWidth={2} strokeDasharray="6 6" fill="none" name="AI Forecast" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-none bg-white/80">
            <CardHeader>
              <CardTitle className="text-lg font-bold tracking-tight">Inventory Split</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inventoryData}
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={8}
                      dataKey="value"
                      stroke="none"
                    >
                      {inventoryData.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg border-none bg-white text-slate-900 overflow-hidden">
          <CardHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold tracking-tight">Top Selling Categories</CardTitle>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Velocity by Product Category</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter italic">Last updated just now</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 pb-8">
            {topCategories.length > 0 ? topCategories.map((cat, i) => (
              <div
                key={cat.name}
                className="group cursor-default"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: `hsl(var(--chart-${(i % 5) + 1}))` }}
                    />
                    <span className="font-bold text-sm tracking-tight text-slate-700">
                      {cat.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-slate-900">{formatCurrency(cat.amount)}</span>
                    <span className="text-xs font-bold text-slate-500 w-10 text-right">{cat.percentage}%</span>
                  </div>
                </div>
                {/* Bara de progres pe fundal alb */}
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200">
                  <div
                    className="h-full rounded-full transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1)"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: `hsl(var(--chart-${(i % 5) + 1}))`,
                      boxShadow: `0 0 15px hsl(var(--chart-${(i % 5) + 1}), 0.3)`
                    }}
                  />
                </div>
              </div>
            )) : (
              <p className="text-center py-4 text-slate-500 italic text-sm">No sales data for categories this week.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <Chatbot storeId={routeStoreId || ""} />
    </DashboardLayout>
  );
};

export default Dashboard;