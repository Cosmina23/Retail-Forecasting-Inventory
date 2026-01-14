import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar,
  TrendingUp,
  Package,
  ShoppingCart,
  Activity,
  Info,
  Settings,
  FileUp,
  FileDown,
  ClipboardList,
  BarChart3,
  RefreshCw,
  Filter,
  Clock,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getActivityLogs, ActivityType } from "@/services/activityLogger";

interface ActivityLog {
  _id: string;
  store_id: string;
  user_id: string;
  action_type: ActivityType;
  description: string;
  details: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
}

const activityConfig: Record<string, { icon: JSX.Element; color: string; label: string }> = {
  forecast_created: {
    icon: <BarChart3 className="w-4 h-4" />,
    color: "bg-chart-1/10 text-chart-1",
    label: "Forecast",
  },
  forecast_viewed: {
    icon: <TrendingUp className="w-4 h-4" />,
    color: "bg-chart-2/10 text-chart-2",
    label: "Forecast Viewed",
  },
  purchase_order_created: {
    icon: <ClipboardList className="w-4 h-4" />,
    color: "bg-primary/10 text-primary",
    label: "Purchase Order",
  },
  purchase_order_updated: {
    icon: <ClipboardList className="w-4 h-4" />,
    color: "bg-primary/10 text-primary",
    label: "PO Updated",
  },
  inventory_optimized: {
    icon: <RefreshCw className="w-4 h-4" />,
    color: "bg-success/10 text-success",
    label: "Optimization",
  },
  inventory_updated: {
    icon: <Package className="w-4 h-4" />,
    color: "bg-warning/10 text-warning",
    label: "Inventory",
  },
  product_added: {
    icon: <Package className="w-4 h-4" />,
    color: "bg-success/10 text-success",
    label: "Product Added",
  },
  product_updated: {
    icon: <Package className="w-4 h-4" />,
    color: "bg-primary/10 text-primary",
    label: "Product Updated",
  },
  product_deleted: {
    icon: <Package className="w-4 h-4" />,
    color: "bg-destructive/10 text-destructive",
    label: "Product Deleted",
  },
  sale_recorded: {
    icon: <ShoppingCart className="w-4 h-4" />,
    color: "bg-success/10 text-success",
    label: "Sale",
  },
  settings_updated: {
    icon: <Settings className="w-4 h-4" />,
    color: "bg-muted-foreground/10 text-muted-foreground",
    label: "Settings",
  },
  data_imported: {
    icon: <FileUp className="w-4 h-4" />,
    color: "bg-chart-3/10 text-chart-3",
    label: "Import",
  },
  data_exported: {
    icon: <FileDown className="w-4 h-4" />,
    color: "bg-chart-4/10 text-chart-4",
    label: "Export",
  },
};

const History = () => {
  const params = useParams();
  const routeStoreId = params.storeId || null;
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [stats, setStats] = useState<Record<string, number>>({});

  const getStoreId = (): string | null => {
    if (routeStoreId) return routeStoreId;
    const sel = localStorage.getItem("selectedStore");
    if (!sel) return null;
    try {
      const parsed = JSON.parse(sel);
      return parsed._id || parsed.id;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const storeId = getStoreId();
    if (!storeId) {
      setLoading(false);
      return;
    }
    fetchActivityLogs(storeId);
  }, [routeStoreId, filter]);

  const fetchActivityLogs = async (storeId: string) => {
    setLoading(true);
    try {
      const filterType = filter === "all" ? undefined : filter;
      const logs = await getActivityLogs(storeId, 100, filterType);
      setActivityLogs(logs);

      // Calculate stats
      const newStats: Record<string, number> = {};
      logs.forEach((log: ActivityLog) => {
        newStats[log.action_type] = (newStats[log.action_type] || 0) + 1;
      });
      setStats(newStats);
    } catch (e) {
      console.error("Failed to fetch activity logs", e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActivityConfig = (type: string) => {
    return activityConfig[type] || {
      icon: <Activity className="w-4 h-4" />,
      color: "bg-muted/10 text-muted-foreground",
      label: type,
    };
  };

  const renderDetails = (details: Record<string, any>) => {
    if (!details || Object.keys(details).length === 0) return null;

    return (
      <div className="mt-2 p-3 bg-muted/30 rounded-lg text-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(details).slice(0, 6).map(([key, value]) => (
            <div key={key}>
              <span className="text-muted-foreground capitalize">
                {key.replace(/_/g, " ")}:
              </span>{" "}
              <span className="font-medium">
                {typeof value === "number"
                  ? value.toLocaleString()
                  : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <Activity className="w-12 h-12 text-primary mx-auto animate-pulse" />
            <p className="text-muted-foreground">Loading activity history...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Filter */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Activity History</h1>
            <p className="text-muted-foreground">
              Track all actions and changes in your store
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                <SelectItem value="forecast_created">Forecasts</SelectItem>
                <SelectItem value="purchase_order_created">Purchase Orders</SelectItem>
                <SelectItem value="inventory_optimized">Optimizations</SelectItem>
                <SelectItem value="inventory_updated">Inventory Updates</SelectItem>
                <SelectItem value="sale_recorded">Sales</SelectItem>
                <SelectItem value="data_imported">Imports</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const storeId = getStoreId();
                if (storeId) fetchActivityLogs(storeId);
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {Object.keys(stats).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Object.entries(stats).slice(0, 6).map(([type, count]) => {
              const config = getActivityConfig(type);
              return (
                <Card key={type} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setFilter(type)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.color}`}>
                        {config.icon}
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-xs text-muted-foreground">{config.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Activity List */}
        {activityLogs.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto">
                <Info className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">No Activity Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Start using the application to see your activity history here.
                Actions like creating forecasts, purchase orders, and inventory
                updates will be logged automatically.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/50 border-b">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                Recent Activity
                <Badge variant="outline" className="ml-2">
                  {activityLogs.length} entries
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {activityLogs.map((log) => {
                  const config = getActivityConfig(log.action_type);
                  return (
                    <div
                      key={log._id}
                      className="px-6 py-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}
                          >
                            {config.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-foreground">
                                {log.description}
                              </p>
                              <Badge variant="secondary" className="text-xs">
                                {config.label}
                              </Badge>
                            </div>
                            <p
                              className="text-sm text-muted-foreground mt-1"
                              title={formatFullDate(log.created_at)}
                            >
                              {formatDate(log.created_at)}
                            </p>
                            {renderDetails(log.details)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default History;