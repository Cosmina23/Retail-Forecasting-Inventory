import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingDown, Package, ShoppingCart } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const monthlyData = [
  { month: "Jul", revenue: 42500 },
  { month: "Aug", revenue: 38200 },
  { month: "Sep", revenue: 45800 },
  { month: "Oct", revenue: 52100 },
  { month: "Nov", revenue: 61500 },
  { month: "Dec", revenue: 48900 },
];

const recentActivity = [
  { date: "Dec 05, 2024", type: "sale", description: "143 orders processed", value: "€12,450.80", positive: true },
  { date: "Dec 04, 2024", type: "sale", description: "128 orders processed", value: "€10,920.50", positive: true },
  { date: "Dec 04, 2024", type: "restock", description: "Stock replenished: Electronics", value: "+250 units", positive: true },
  { date: "Dec 03, 2024", type: "alert", description: "Low stock: iPhone 15 Pro", value: "12 units", positive: false },
  { date: "Dec 03, 2024", type: "sale", description: "156 orders processed", value: "€14,280.20", positive: true },
  { date: "Dec 02, 2024", type: "sale", description: "112 orders processed", value: "€9,150.40", positive: true },
];

const History = () => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "sale":
        return <ShoppingCart className="w-4 h-4" />;
      case "restock":
        return <Package className="w-4 h-4" />;
      default:
        return <TrendingDown className="w-4 h-4" />;
    }
  };

  const getActivityBadge = (type: string) => {
    switch (type) {
      case "sale":
        return <Badge className="bg-success/10 text-success hover:bg-success/20">Sale</Badge>;
      case "restock":
        return <Badge className="bg-primary/10 text-primary hover:bg-primary/20">Restock</Badge>;
      default:
        return <Badge className="bg-warning/10 text-warning hover:bg-warning/20">Alert</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Monthly Performance */}
        <Card className="animate-fade-up">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Monthly Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickFormatter={(v) => `€${v / 1000}k`} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: "hsl(var(--chart-1))" }}
                    name="Revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      activity.type === "sale" 
                        ? "bg-success/10 text-success" 
                        : activity.type === "restock"
                        ? "bg-primary/10 text-primary"
                        : "bg-warning/10 text-warning"
                    }`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{activity.description}</p>
                      <p className="text-sm text-muted-foreground">{activity.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getActivityBadge(activity.type)}
                    <span className={`font-semibold ${activity.positive ? "text-success" : "text-warning"}`}>
                      {activity.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default History;
