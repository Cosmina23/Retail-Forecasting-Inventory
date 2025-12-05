import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Calendar, Target } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Bar, BarChart } from "recharts";

const forecastData = [
  { week: "Week 49", predicted: 45200, lower: 42000, upper: 48500 },
  { week: "Week 50", predicted: 52800, lower: 49500, upper: 56100 },
  { week: "Week 51", predicted: 68500, lower: 64200, upper: 72800 },
  { week: "Week 52", predicted: 85200, lower: 80100, upper: 90300 },
];

const categoryForecast = [
  { category: "Electronics", current: 12500, forecast: 18200 },
  { category: "Clothing", current: 8900, forecast: 15600 },
  { category: "Home", current: 5200, forecast: 7800 },
];

const Forecasting = () => {
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
        {/* Summary Cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="animate-fade-up">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Week 52 Forecast</p>
                  <p className="text-xl font-bold text-foreground">€85,200</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="animate-fade-up" style={{ animationDelay: "0.05s" }}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expected Growth</p>
                  <p className="text-xl font-bold text-success">+88%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Confidence Interval</p>
                  <p className="text-xl font-bold text-foreground">±6%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Forecast Chart */}
        <Card className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Revenue Forecast - Next 4 Weeks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRange" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
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
                    dataKey="upper"
                    stroke="transparent"
                    fill="url(#colorRange)"
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
                    fillOpacity={1}
                    fill="url(#colorPredicted)"
                    name="Forecast"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Forecast */}
        <Card className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Category Forecast (December)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryForecast} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal />
                  <XAxis type="number" tickFormatter={(v) => `€${v / 1000}k`} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="current" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} name="Current" />
                  <Bar dataKey="forecast" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} name="Forecast" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-muted" />
                <span className="text-sm text-muted-foreground">Current Month</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                <span className="text-sm text-muted-foreground">Forecast</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Forecasting;
