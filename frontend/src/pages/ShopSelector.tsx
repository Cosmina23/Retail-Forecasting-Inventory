import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Store, Plus, TrendingUp, LogOut, Settings } from "lucide-react";

const shops = [
  { id: 1, name: "Berlin Alexanderplatz", status: "online", revenue: 12450.80 },
  { id: 2, name: "Munich Marienplatz", status: "online", revenue: 18320.50 },
  { id: 3, name: "Hamburg Jungfernstieg", status: "offline", revenue: 9875.25 },
  { id: 4, name: "Frankfurt Zeil", status: "online", revenue: 15680.90 },
  { id: 5, name: "Cologne Schildergasse", status: "online", revenue: 11240.15 },
  { id: 6, name: "Stuttgart Königstraße", status: "online", revenue: 8950.60 },
];

const ShopSelector = () => {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-foreground">StockSentinel</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/login")}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Your Stores</h1>
            <p className="text-muted-foreground">Select a store to open its dashboard</p>
          </div>
          <Button variant="hero">
            <Plus className="w-4 h-4 mr-2" /> New Store
          </Button>
        </div>

        {/* Shop Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {shops.map((shop, index) => (
            <div
              key={shop.id}
              onClick={() => navigate("/dashboard")}
              className="bg-card border rounded-xl p-6 cursor-pointer card-hover shadow-card animate-fade-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      shop.status === "online" ? "bg-success" : "bg-destructive"
                    }`}
                  />
                  <span className="text-xs text-muted-foreground capitalize">
                    {shop.status === "online" ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
              
              <h3 className="font-semibold text-foreground mb-1">{shop.name}</h3>
              
              <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-sm text-muted-foreground">Daily Revenue:</span>
                <span className="text-sm font-semibold text-foreground ml-auto">
                  {formatCurrency(shop.revenue)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default ShopSelector;
