import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Calendar, Target, Info, Activity, BarChart3 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Bar, BarChart, Legend } from "recharts";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const Forecasting = () => {
  const params = useParams();
  const routeStoreId = params.storeId || null;

  const [forecastData, setForecastData] = useState<any[]>([]);
  const [categoryForecast, setCategoryForecast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sel = routeStoreId ? null : localStorage.getItem("selectedStore");
    const storeId = routeStoreId || (sel ? (() => { try { return JSON.parse(sel).id || JSON.parse(sel)._id } catch { return null } })() : null);

    if (!storeId) {
      setLoading(false);
      return;
    }

    fetchForecasts(storeId);
  }, [routeStoreId]);

  const fetchForecasts = async (storeId: string) => {
    setLoading(true);
    const base = "http://localhost:8000/api";
    try {
      const [resWeekly, resCategory] = await Promise.all([
        fetch(`${base}/forecasts/weekly?store_id=${storeId}`),
        fetch(`${base}/forecasts/category?store_id=${storeId}`)
      ]);

      if (resWeekly.ok) {
        const data = await resWeekly.json();
        setForecastData(data);
      }

      if (resCategory.ok) {
        const data = await resCategory.json();
        setCategoryForecast(data);
      }
    } catch (e) {
      console.error("Failed to fetch forecasts", e);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (forecastData.length === 0) return { lastForecast: 0, growth: 0, confidence: 0 };

    const last = forecastData[forecastData.length - 1];
    const first = forecastData[0];

    const lastVal = last.predicted || 0;
    const firstVal = first.predicted || 1;
    const growth = ((lastVal - firstVal) / firstVal) * 100;

    const confidence = last.predicted ? ((last.upper - last.predicted) / last.predicted) * 100 : 0;

    return {
      lastForecast: lastVal,
      growth: growth.toFixed(1),
      confidence: confidence.toFixed(1)
    };
  }, [forecastData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <Activity className="w-12 h-12 text-primary mx-auto animate-pulse" />
            <p className="text-muted-foreground">Fetching real-time projections...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {forecastData.length === 0 ? (
          <div className="p-12 border-2 border-dashed rounded-xl text-center space-y-4 animate-fade-up bg-card">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto">
              <Info className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">No Forecast Data Available</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Run your ML model or import historical sales data to generate future revenue projections.
            </p>
          </div>
        ) : (
          <>
            {/* Summary Cards with Enhanced Styling */}
            <div className="grid sm:grid-cols-3 gap-4 animate-fade-up">
              <Card className="border-l-4 border-l-primary hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Target className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Latest Forecast</p>
                      <p className="text-2xl font-bold mt-1">{formatCurrency(stats.lastForecast)}</p>
                      <Badge variant="outline" className="mt-2 text-xs">Next 4 weeks</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-success hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-success" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Projected Growth</p>
                      <p className="text-2xl font-bold text-success mt-1">+{stats.growth}%</p>
                      <Badge className="mt-2 text-xs bg-success/10 text-success hover:bg-success/20">Trending up</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Confidence Range</p>
                      <p className="text-2xl font-bold mt-1">±{stats.confidence}%</p>
                      <Badge variant="outline" className="mt-2 text-xs">Prediction interval</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Forecast Chart with Enhanced Design */}
            <Card className="animate-fade-up overflow-hidden border shadow-sm hover:shadow-md transition-shadow duration-300">
              <CardHeader className="bg-muted/50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    Revenue Forecast
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    <Activity className="w-3 h-3 mr-1" />
                    Live Data
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecastData}>
                      <defs>
                        <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis
                        dataKey="week"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickMargin={10}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis
                        tickFormatter={(v) => `€${v / 1000}k`}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickMargin={10}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <Tooltip
                        formatter={(v: number) => formatCurrency(v)}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="circle"
                      />
                      <Area
                        type="monotone"
                        dataKey="upper"
                        stroke="transparent"
                        fill="hsl(var(--chart-1))"
                        fillOpacity={0.1}
                        name="Upper Bound"
                      />
                      <Area
                        type="monotone"
                        dataKey="lower"
                        stroke="transparent"
                        fill="hsl(var(--background))"
                        name="Lower Bound"
                      />
                      <Area
                        type="monotone"
                        dataKey="predicted"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={3}
                        fill="url(#colorPredicted)"
                        name="Predicted Revenue"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Category Forecast Section (if data available) */}
            {categoryForecast.length > 0 && (
              <Card className="animate-fade-up overflow-hidden border shadow-sm hover:shadow-md transition-shadow duration-300">
                <CardHeader className="bg-muted/50 border-b">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-primary" />
                    </div>
                    Category Forecasts
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryForecast}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis
                          dataKey="category"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickMargin={10}
                        />
                        <YAxis
                          tickFormatter={(v) => `€${v / 1000}k`}
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickMargin={10}
                        />
                        <Tooltip
                          formatter={(v: number) => formatCurrency(v)}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Legend iconType="circle" />
                        <Bar dataKey="current" fill="hsl(var(--muted))" name="Current" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="forecast" fill="hsl(var(--chart-1))" name="Forecast" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Forecasting;

