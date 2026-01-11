import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, TrendingUp, History, ChevronLeft, Settings, Bell, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import apiService from "@/services/api";

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Package, label: "Inventory", path: "/inventory" },
  { icon: TrendingUp, label: "Forecasting", path: "/forecasting" },
  { icon: FileText, label: "Purchase Orders", path: "/purchase-orders" },
  { icon: History, label: "History", path: "/history" },
];

interface Notification {
  id: string;
  type: string;
  message: string;
  details?: string;
  timestamp: string;
  unread: boolean;
  severity: string;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [storeName, setStoreName] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState<string>("U");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  useEffect(() => {
    try {
      const sel = localStorage.getItem("selectedStore");
      if (sel) {
        const store = JSON.parse(sel);
        setStoreName(store.name || null);
        setStoreId(store._id || store.id || null);
      }
    } catch (e) {
      // ignore
    }

    try {
      const u = localStorage.getItem("user");
      if (u) {
        const user = JSON.parse(u);
        if (user.name) {
          const parts = String(user.name).split(" ").filter(Boolean);
          const initials = parts.map((p: string) => p[0]).slice(0, 2).join("");
          setUserInitials(initials.toUpperCase());
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Fetch notifications when storeId changes
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!storeId) return;

      setIsLoadingNotifications(true);
      try {
        const data = await apiService.getNotifications(storeId);
        setNotifications(data || []);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
        setNotifications([]);
      } finally {
        setIsLoadingNotifications(false);
      }
    };

    fetchNotifications();

    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, [storeId]);

  const linkFor = (basePath: string) => {
    if (!storeId) return basePath;
    return `${basePath}/${storeId}`;
  };

  const markAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsRead(storeId || undefined);
      setNotifications(notifications.map(n => ({ ...n, unread: false })));
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
    }
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/index")}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md gradient-primary flex items-center justify-center">
              <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-semibold text-sidebar-foreground text-sm">StockSentinel</span>
          </div>
        </div>

        <div className="px-3 py-2">
          <p className="text-xs text-muted-foreground px-3 mb-2">{storeName || "No Store Selected"}</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                to={linkFor(item.path)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t">
          <Link
            to="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <Settings className="w-5 h-5" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="h-14 border-b bg-card flex items-center justify-between px-6">
          <h1 className="font-semibold text-foreground">
            {navItems.find((item) => item.path === location.pathname || location.pathname.startsWith(item.path + "/"))?.label || "Dashboard"}
          </h1>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-xs" onClick={markAllAsRead}>
                      Mark all as read
                    </Button>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isLoadingNotifications ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Loading notifications...
                  </div>
                ) : notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <DropdownMenuItem key={notification.id} className="flex flex-col items-start p-3 cursor-pointer">
                      <div className="flex items-start gap-2 w-full">
                        {notification.unread && (
                          <span className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm", notification.unread && "font-medium")}>
                            {notification.message}
                          </p>
                          {notification.details && (
                            <p className="text-xs text-muted-foreground mt-0.5">{notification.details}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">{formatTimestamp(notification.timestamp)}</p>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
              {userInitials}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
