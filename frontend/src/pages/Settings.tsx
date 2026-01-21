import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, RotateCcw, Bell, Package, DollarSign, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AppSettings {
  theme: "light" | "dark" | "system";
  currency: string;
  dateFormat: string;
  language: string;
  lowStockThreshold: number;
  criticalStockThreshold: number;
  defaultLeadTimeDays: number;
  autoReorderEnabled: boolean;
  lowStockAlerts: boolean;
  orderConfirmations: boolean;
  dailySummary: boolean;
  emailNotifications: boolean;
  taxRate: number;
  defaultMarkup: number;
}

const defaultSettings: AppSettings = {
  theme: "system",
  currency: "EUR",
  dateFormat: "DD/MM/YYYY",
  language: "en",
  lowStockThreshold: 20,
  criticalStockThreshold: 5,
  defaultLeadTimeDays: 7,
  autoReorderEnabled: false,
  lowStockAlerts: true,
  orderConfirmations: true,
  dailySummary: false,
  emailNotifications: true,
  taxRate: 19,
  defaultMarkup: 30,
};

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem("appSettings");
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        applyTheme(parsed.theme);
      } catch {
        setSettings(defaultSettings);
        applyTheme(defaultSettings.theme);
      }
    } else {
      applyTheme(defaultSettings.theme);
    }
  }, []);

  const applyTheme = (theme: "light" | "dark" | "system") => {
    const root = document.documentElement;

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.toggle("dark", systemTheme === "dark");
    } else {
      root.classList.toggle("dark", theme === "dark");
    }
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const newSettings = { ...prev, [key]: value };
      if (key === "theme") {
        applyTheme(value as "light" | "dark" | "system");
      }
      return newSettings;
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    localStorage.setItem("appSettings", JSON.stringify(settings));
    setHasChanges(false);
    toast({
      title: "Settings saved",
      description: "Your preferences have been saved successfully.",
    });
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    localStorage.removeItem("appSettings");
    applyTheme(defaultSettings.theme);
    setHasChanges(false);
    toast({
      title: "Settings reset",
      description: "All settings have been restored to defaults.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/index")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-foreground">Settings</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Display Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                <CardTitle>Display Preferences</CardTitle>
              </div>
              <CardDescription>Customize how the application looks and displays information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select value={settings.theme} onValueChange={(v: "light" | "dark" | "system") => updateSetting("theme", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={settings.currency} onValueChange={(v) => updateSetting("currency", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="RON">RON (lei)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Select value={settings.dateFormat} onValueChange={(v) => updateSetting("dateFormat", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select value={settings.language} onValueChange={(v) => updateSetting("language", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ro">Română</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <CardTitle>Inventory Settings</CardTitle>
              </div>
              <CardDescription>Configure stock thresholds and reorder preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="lowStock">Low Stock Threshold (units)</Label>
                  <Input
                    id="lowStock"
                    type="number"
                    min="1"
                    value={settings.lowStockThreshold}
                    onChange={(e) => updateSetting("lowStockThreshold", parseInt(e.target.value) || 0)}
                  /><p className="text-xs text-muted-foreground">Alert when stock falls below this level</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="criticalStock">Critical Stock Threshold (units)</Label>
                  <Input
                    id="criticalStock"
                    type="number"
                    min="1"
                    value={settings.criticalStockThreshold}
                    onChange={(e) => updateSetting("criticalStockThreshold", parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">Urgent alert when stock is critically low</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leadTime">Default Lead Time (days)</Label>
                  <Input
                    id="leadTime"
                    type="number"
                    min="1"
                    value={settings.defaultLeadTimeDays}
                    onChange={(e) => updateSetting("defaultLeadTimeDays", parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-muted-foreground">Expected delivery time for reorders</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-Reorder</Label>
                      <p className="text-xs text-muted-foreground">Automatically create purchase orders</p>
                    </div>
                    <Switch
                      checked={settings.autoReorderEnabled}
                      onCheckedChange={(v) => updateSetting("autoReorderEnabled", v)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <CardTitle>Notifications</CardTitle>
              </div>
              <CardDescription>Manage your alert and notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Low Stock Alerts</Label>
                  <p className="text-sm text-muted-foreground">Notify when items reach low stock threshold</p>
                </div>
                <Switch checked={settings.lowStockAlerts} onCheckedChange={(v) => updateSetting("lowStockAlerts", v)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Order Confirmations</Label>
                  <p className="text-sm text-muted-foreground">Confirm when purchase orders are created</p>
                </div>
                <Switch checked={settings.orderConfirmations} onCheckedChange={(v) => updateSetting("orderConfirmations", v)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Daily Summary</Label>
                  <p className="text-sm text-muted-foreground">Receive a daily inventory summary</p>
                </div>
                <Switch checked={settings.dailySummary} onCheckedChange={(v) => updateSetting("dailySummary", v)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send notifications to your email</p>
                </div>
                <Switch checked={settings.emailNotifications} onCheckedChange={(v) => updateSetting("emailNotifications", v)} />
              </div>
            </CardContent>
          </Card>

          {/* Business Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                <CardTitle>Business Settings</CardTitle>
              </div>
              <CardDescription>Configure tax rates and pricing defaults</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="taxRate">Default Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    value={settings.taxRate}
                    onChange={(e) => updateSetting("taxRate", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="markup">Default Markup (%)</Label>
                  <Input
                    id="markup"
                    type="number"
                    min="0"
                    value={settings.defaultMarkup}
                    onChange={(e) => updateSetting("defaultMarkup", parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;