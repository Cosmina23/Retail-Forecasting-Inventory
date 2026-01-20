import { useState, useEffect, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, TrendingUp, AlertTriangle, ShoppingCart, Loader2, PieChart as PieChartIcon } from "lucide-react";
import { useParams } from "react-router-dom";
import { apiService } from "@/services/api";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { logActivity} from "@/services/activityLogger";

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

const Inventory = () => {
  const { storeId } = useParams<{ storeId: string }>();

  const [leadTime, setLeadTime] = useState<number>(7);
  const [serviceLevel, setServiceLevel] = useState<number>(0.95);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OptimizationResponse | null>(null);
  const[inventory,setInventory]=useState<any[]>();

  const handleOptimize = useCallback(async (lTime: number, sLevel: number) => {
    if (!storeId) return;
    setLoading(true);
    try {
      const response = await apiService.getInventoryOptimization(storeId, lTime, sLevel);
      setData(response);

      // Log the activity
      await logActivity(
        storeId,
        "inventory_optimized",
        `Optimized inventory with ${lTime} day lead time and ${(sLevel * 100).toFixed(0)}% service level`,
        {
          lead_time_days: lTime,
          service_level: sLevel,
          total_products: response.total_products,
          critical_items: response.metrics.filter((m: InventoryMetric) => m.status === "Critical" || m.status === "Low - Order Now").length,
          total_annual_revenue: response.total_annual_revenue,
        }
      );

    } catch (error: any) {
      console.error("Failed to optimize inventory:", error);
      toast.error(error.message || "Failed to generate optimization data");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (storeId) {
      handleOptimize(7, 0.95);
    }
  }, [storeId, handleOptimize]);

  const onParamChange = (value: string, type: 'lead' | 'service') => {
    const numVal = Number(value);
    if (type === 'lead') {
      setLeadTime(numVal);
      handleOptimize(numVal, serviceLevel);
    } else {
      setServiceLevel(numVal);
      handleOptimize(leadTime, numVal);
    }
  };

  const displayedMetrics = useMemo(() => {
    const raw = data?.metrics ?? [];
    const map = new Map<string, any>();
    raw.forEach(m => {
      const key = (m.product || m.sku|| "").toString();
      if (!map.has(key)) map.set(key, m);
    });
    return Array.from(map.values());
  }, [data]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Critical": return "bg-rose-500";
      case "Low - Order Now": return "bg-orange-500";
      case "Moderate": return "bg-amber-500";
      case "Healthy": return "bg-emerald-500";
      default: return "bg-slate-400";
    }
  };

  const getABCColor = (classification: string) => {
    switch (classification) {
      case "A": return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
      case "B": return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "C": return "bg-slate-500/10 text-slate-600 border-slate-200";
      default: return "bg-slate-100 text-slate-500 border-slate-200";
    }
  };

  const abcChartData = data?.abc_summary ? [
    { name: "A - High Value", short: "A", value: data.abc_summary.A ?? 0, color: "#10b981" },
    { name: "B - Medium Value", short: "B", value: data.abc_summary.B ?? 0, color: "#3b82f6" },
    { name: "C - Low Value", short: "C", value: data.abc_summary.C ?? 0, color: "#94a3b8" }
  ] : [];

  if (loading && !data) {
    return (
      <DashboardLayout>
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium animate-pulse">Running intelligent optimization...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-40px)] w-full space-y-4 p-4 overflow-hidden animate-in fade-in duration-500">

        {/* Parameters Section */}
        <Card className="border-none shadow-sm bg-slate-50/50 backdrop-blur-sm shrink-0">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg shadow-inner">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold tracking-tight text-slate-800">Optimization Parameters</h2>
              </div>

              <div className="flex items-center gap-6 flex-1 justify-center">
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-1 mb-1 tracking-wider">Lead Time</label>
                  <Select value={leadTime.toString()} onValueChange={(v) => onParamChange(v, 'lead')}>
                    <SelectTrigger className="w-[160px] h-9 bg-white border-slate-200 shadow-sm focus:ring-primary/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Days (Fast)</SelectItem>
                      <SelectItem value="7">7 Days (Standard)</SelectItem>
                      <SelectItem value="14">14 Days (Slow)</SelectItem>
                      <SelectItem value="30">30 Days (Global)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-1 mb-1 tracking-wider">Service Level</label>
                  <Select value={serviceLevel.toString()} onValueChange={(v) => onParamChange(v, 'service')}>
                    <SelectTrigger className="w-[160px] h-9 bg-white border-slate-200 shadow-sm focus:ring-primary/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.90">90% (Low Risk)</SelectItem>
                      <SelectItem value="0.95">95% (Balanced)</SelectItem>
                      <SelectItem value="0.99">99% (Aggressive)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {data ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
              {[
                { label: "Total Products", value: data.total_products, icon: Package, color: "blue" },
                { label: "Action Required", value: data.metrics.filter(m => m.status === "Critical" || m.status === "Low - Order Now").length, icon: AlertTriangle, color: "rose" },
                { label: "Annual Revenue", value: new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(data.total_annual_revenue), icon: ShoppingCart, color: "emerald" },
                { label: "Avg Coverage", value: `${(data.metrics.reduce((acc, curr) => acc + (curr.stock_days || 0), 0) / data.metrics.length).toFixed(1)} Days`, icon: TrendingUp, color: "indigo" }
              ].map((kpi, i) => (
                <Card key={i} className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`p-2.5 bg-${kpi.color}-50 text-${kpi.color}-500 rounded-xl`}>
                      <kpi.icon className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{kpi.label}</p>
                      <p className="text-xl font-black text-slate-900 leading-none">{kpi.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 grid lg:grid-cols-3 gap-4 overflow-hidden">

              {/* ABC CLASSIFICATION - DESIGN NOU (Donut Chart) */}
              <Card className="lg:col-span-1 h-full border-none shadow-sm flex flex-col bg-white overflow-hidden">
                <CardHeader className="py-4 px-6 border-b border-slate-50 shrink-0">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                    <PieChartIcon className="w-4 h-4 text-primary" /> ABC Distribution Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-6 overflow-hidden">
                  {/* Containerul graficului cu text central */}
                  <div className="relative flex-1 min-h-[220px]">
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Total SKU</span>
                      <span className="text-3xl font-black text-slate-900">{data.total_products}</span>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        />
                        <Pie
                          data={abcChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius="65%"
                          outerRadius="90%"
                          paddingAngle={6}
                          dataKey="value"
                          stroke="none"
                        >
                          {abcChartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.color}
                              className="focus:outline-none transition-opacity hover:opacity-80"
                            />
                          ))}
                        </Pie>
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>

                  {/* Legenda rafinată */}
                  <div className="grid grid-cols-1 gap-3 mt-6">
                    {abcChartData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                          <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-black text-slate-900">{item.value}</span>
                           <span className="text-[10px] font-bold text-slate-400">({((item.value / data.total_products) * 100).toFixed(0)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Info Box */}
                  <div className="mt-auto pt-4 border-t border-slate-100 italic">
                    <p className="text-[10px] text-slate-400 leading-relaxed text-center">
                      Analysis based on annual revenue contribution per SKU.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Optimization Results Table */}
              <Card className="lg:col-span-2 h-full border-none shadow-sm flex flex-col bg-white overflow-hidden">
                <CardHeader className="py-4 px-6 border-b border-slate-50 shrink-0">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Optimization Recommendations</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white/95 backdrop-blur-md z-10 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b border-slate-100">
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 h-11 px-6">Product</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-center text-slate-400 h-11">ABC</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right text-slate-400 h-11">Stock</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right text-slate-400 h-11">ROP</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right text-slate-400 h-11 px-6">Order Qty</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-center text-slate-400 h-11 pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedMetrics.map((m, i) => (
                        <TableRow key={i} className="hover:bg-slate-50/50 border-b border-slate-50 transition-colors">
                          <TableCell className="font-semibold text-[11px] text-slate-700 py-3.5 px-6 max-w-[200px] truncate">{m.product}</TableCell>
                          <TableCell className="text-center py-3.5">
                            <Badge className={`${getABCColor(m.abc_classification)} text-[9px] px-1.5 h-5 border font-bold`} variant="outline">{m.abc_classification}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-[11px] text-slate-600 py-3.5">{m.current_stock}</TableCell>
                          <TableCell className="text-right font-bold text-[11px] text-slate-900 py-3.5">{m.reorder_point}</TableCell>
                          <TableCell className="text-right font-black text-primary text-[11px] py-3.5 px-6">{m.recommended_order_qty}</TableCell>
                          <TableCell className="text-center py-3.5 pr-6">
                            <Badge className={`${getStatusColor(m.status)} text-[9px] text-white border-none font-bold px-2 py-0.5 shadow-sm`}>
                              {m.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white/50 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="p-4 bg-slate-100 rounded-full mb-4">
               <PieChartIcon className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-slate-500 font-bold tracking-tight">System Ready for Analysis</p>
            <p className="text-slate-400 text-xs">Awaiting store data optimization...</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Inventory;