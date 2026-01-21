import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
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
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowRight, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const { t } = useTranslation();
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

  const navigate = useNavigate();
  const [isCriticalModalOpen, setIsCriticalModalOpen] = useState(false);
  const [criticalItems, setCriticalItems] = useState<any[]>([]);
  const [loadingCritical, setLoadingCritical] = useState(false);

  const handleCriticalItemsClick = async () => {
  setIsCriticalModalOpen(true);
  setLoadingCritical(true);
  try {
    const token = localStorage.getItem('access_token');
    const storeId = routeStoreId || JSON.parse(localStorage.getItem("selectedStore") || "{}").id;

    const res = await fetch(`http://localhost:8000/api/stores/${storeId}/critical-items-list`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setCriticalItems(data);
    }
  } catch (err) {
    console.error("Failed to fetch critical items", err);
  } finally {
    setLoadingCritical(false);
  }
};

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

      // Am eliminat iRes separat, deoarece metrics ne aduce acum inventory_data procesat
      const [sfRes, mRes] = await Promise.all([
        fetch(forecastUrl, { headers }),
        fetch(`${base}/stores/${id}/metrics?offset=${offset}`, { headers })
      ]);
      if (sfRes.ok) {
        const data = await sfRes.json();
        setSalesData(data.length ? data : fallbackSales());
      }

      if (mRes.ok) {
        const m = await mRes.json();
        setMaxOffset(m.max_offset || 0);
        setTopCategories(m.top_categories || []);

        setStats([
          {
            label: offset === 0 ? "Weekly Revenue" : "Revenue (Historical)",
            value: formatCurrency(m.weekly_revenue ?? 0),
            positive: (m.revenue_change || 0) >= 0,
            icon: Euro,
          },
          {
            label: offset === 0 ? "Weekly Orders" : "Orders (Historical)",
            value: String(m.orders ?? 0),
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

        // REPARĂM PIE CHART: Folosim datele procesate din Backend (cu Join)
        if (m.inventory_data) {
          setInventoryData(m.inventory_data.map((item: any, i: number) => ({
            name: item.name,
            value: item.value,
            color: `hsl(var(--chart-${(i % 5) + 1}))`
          })));
        }
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
          {t('common.loading')}
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
              {t('dashboard.title')}
            </h1>
            <p className="text-muted-foreground font-medium">
              {weekOffset === 0 ? t('dashboard.weeklyPerformance') : t('dashboard.historicalData', { weeks: weekOffset })}
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
              title={t('dashboard.resetToCurrentWeek')}
            >
              <Calendar className={`w-4 h-4 transition-colors ${weekOffset === 0 ? "text-blue-500" : "text-slate-400 group-hover:text-blue-500"}`} />
              <span className="min-w-[100px] text-center">
                {weekOffset === 0 ? t('dashboard.currentWeek') : t('dashboard.weeksAgo', { weeks: weekOffset })}
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
            <Card key={s.label}
      onClick={s.label === "Critical Items" ? handleCriticalItemsClick : undefined}
      className={cn(
        "group relative overflow-hidden border-none shadow-md hover:shadow-2xl transition-all duration-300 bg-white/60 backdrop-blur-md hover:-translate-y-1",
        s.label === "Critical Items" && "cursor-pointer hover:bg-rose-50/50" // Feedback vizual la hover
      )}>
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
                    <p className="text-xs text-slate-400">{t('dashboard.comparingSales')}</p>
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
              <CardTitle className="text-lg font-bold tracking-tight">{t('dashboard.inventorySplit')}</CardTitle>
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
                <CardTitle className="text-xl font-bold tracking-tight">{t('dashboard.topCategories')}</CardTitle>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{t('dashboard.velocityByCategory')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter italic">{t('dashboard.lastUpdated')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 pb-8">
            {topCategories.length > 0 ? topCategories.map((cat, i) => (
              <div
                  key={cat.name}
                  className={cn(
                    "group cursor-pointer p-3 rounded-2xl transition-all duration-200 border border-transparent",
                    selectedCategory === cat.name
                      ? "bg-blue-50/50 border-blue-100 shadow-sm"
                      : "hover:bg-slate-50/80"
                  )}
                  onClick={() => {
                    // Logică de toggle: dacă e deja selectată, o deselectăm (null). Altfel, o setăm.
                    setSelectedCategory(selectedCategory === cat.name ? null : cat.name);
                  }}
                >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-3.5 h-3.5 rounded-full shadow-sm transition-transform duration-300",
                        selectedCategory === cat.name ? "scale-125" : "group-hover:scale-110"
                      )}
                      style={{ backgroundColor: `hsl(var(--chart-${(i % 5) + 1}))` }}
                    />
                    <span className={cn(
                        "font-bold text-sm tracking-tight transition-colors",
                        selectedCategory === cat.name ? "text-blue-700" : "text-slate-700"
                      )}>
                      {cat.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-slate-900">{formatCurrency(cat.amount)}</span>
                    <span className="text-xs font-bold text-slate-400 w-10 text-right">{cat.percentage}%</span>
                  </div>
                </div>
                {/* Bara de progres */}
                <div className="h-2 w-full bg-slate-100/80 rounded-full overflow-hidden border border-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1)"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: `hsl(var(--chart-${(i % 5) + 1}))`,
                      boxShadow: selectedCategory === cat.name
                        ? `0 0 12px hsl(var(--chart-${(i % 5) + 1}), 0.5)`
                        : `0 0 8px hsl(var(--chart-${(i % 5) + 1}), 0.2)`
                    }}
                  />
                </div>
              </div>
            )) : (
              <p className="text-center py-4 text-slate-500 italic text-sm">{t('dashboard.noSalesData')}</p>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog open={isCriticalModalOpen} onOpenChange={setIsCriticalModalOpen}>
  <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 text-rose-600">
        <AlertTriangle className="w-5 h-5" />
        Critical Inventory Alerts
      </DialogTitle>
      <DialogDescription>
        The following items have reached or dropped below their reorder point.
      </DialogDescription>
    </DialogHeader>

    <div className="flex-1 overflow-y-auto py-4">
      {loadingCritical ? (
        <div className="flex justify-center p-8 italic text-slate-500">Loading products...</div>
      ) : criticalItems.length > 0 ? (
        <div className="space-y-3">
          {criticalItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <p className="font-bold text-slate-900">{item.product_name}</p>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-tighter">{item.category}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-rose-600">Stock: {item.quantity}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Threshold: {item.reorder_point}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400">
          <Inbox className="w-12 h-12 mb-2 opacity-20" />
          <p>Great job! No items are currently in critical stock.</p>
        </div>
      )}
    </div>

    {criticalItems.length > 0 && (
  <div className="pt-4 border-t mt-auto">
    <Button
      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
      onClick={() => {
        // Verificator: vedem ce trimitem
        console.log("Trimitere către PO cu produsele:", criticalItems);

        // Navigăm și transmitem starea
        navigate(`/purchase-orders/${params.storeId || routeStoreId}`, {
          state: { items: criticalItems }
        });

        setIsCriticalModalOpen(false);
      }}
    >
      Generate Purchase Order
      <ArrowRight className="w-4 h-4 ml-2" />
    </Button>
  </div>
)}
  </DialogContent>
</Dialog>
    </DashboardLayout>
  );
};

export default Dashboard;