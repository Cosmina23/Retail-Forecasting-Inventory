import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Save, RotateCcw, Bell, Package, DollarSign, Palette, Calendar, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { apiService } from "@/services/api";
import { useTranslation } from "@/hooks/useTranslation";

interface AppSettings {
  // Display Settings
  theme: "light" | "dark" | "system";
  currency: string;
  dateFormat: string;
  language: string;

  // Inventory Settings
  lowStockThreshold: number;
  criticalStockThreshold: number;
  defaultLeadTimeDays: number;
  autoReorderEnabled: boolean;

  // Notification Settings
  lowStockAlerts: boolean;
  orderConfirmations: boolean;
  dailySummary: boolean;
  emailNotifications: boolean;

  // Business Settings
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

interface Holiday {
  id: string;
  name: string;
  event_type: "public_holiday" | "shopping_event" | "seasonal";
  date: string;
  market: string;
  impact_level: "high" | "medium" | "low";
  typical_demand_change?: number;
  affected_categories: string[];
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language, setLanguage } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Holidays state
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState<Partial<Holiday>>({
    name: "",
    event_type: "shopping_event",
    date: "",
    market: "Germany",
    impact_level: "medium",
    typical_demand_change: 0,
    affected_categories: []
  });

  useEffect(() => {
    const savedSettings = localStorage.getItem("appSettings");
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        // Sync language from saved settings if available
        if (parsed.language) {
          setLanguage(parsed.language as 'en' | 'ro' | 'de');
        }
      } catch {
        setSettings(defaultSettings);
      }
    } else {
      // Sync with context language if no saved settings
      setSettings(prev => ({ ...prev, language }));
    }
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    setLoadingHolidays(true);
    try {
      const response = await apiService.getHolidays();
      setHolidays(response.holidays || []);
    } catch (error: any) {
      console.error("Failed to load holidays:", error);
      sonnerToast.error("Failed to load holidays");
    } finally {
      setLoadingHolidays(false);
    }
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    
    // Sync language with context
    if (key === 'language') {
      setLanguage(value as 'en' | 'ro' | 'de');
    }
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
    setHasChanges(false);
    toast({
      title: "Settings reset",
      description: "All settings have been restored to defaults.",
    });
  };

  const handleOpenDialog = (holiday?: Holiday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setHolidayForm(holiday);
    } else {
      setEditingHoliday(null);
      setHolidayForm({
        name: "",
        event_type: "shopping_event",
        date: "",
        market: "Germany",
        impact_level: "medium",
        typical_demand_change: 0,
        affected_categories: []
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveHoliday = async () => {
    try {
      if (!holidayForm.name || !holidayForm.date) {
        sonnerToast.error("Please fill in all required fields");
        return;
      }

      // Convert date to ISO format
      const holidayData = {
        ...holidayForm,
        date: new Date(holidayForm.date!).toISOString(),
      };

      if (editingHoliday) {
        await apiService.updateHoliday(editingHoliday.id, holidayData);
        sonnerToast.success("Holiday updated successfully");
      } else {
        await apiService.createHoliday(holidayData);
        sonnerToast.success("Holiday created successfully");
      }

      setIsDialogOpen(false);
      loadHolidays();
    } catch (error: any) {
      console.error("Failed to save holiday:", error);
      sonnerToast.error(error.message || "Failed to save holiday");
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    if (!confirm("Are you sure you want to delete this holiday?")) return;

    try {
      await apiService.deleteHoliday(holidayId);
      sonnerToast.success("Holiday deleted successfully");
      loadHolidays();
    } catch (error: any) {
      console.error("Failed to delete holiday:", error);
      sonnerToast.error(error.message || "Failed to delete holiday");
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case "public_holiday": return "Public Holiday";
      case "shopping_event": return "Shopping Event";
      case "seasonal": return "Seasonal";
      default: return type;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "public_holiday": return "bg-blue-500/10 text-blue-500";
      case "shopping_event": return "bg-purple-500/10 text-purple-500";
      case "seasonal": return "bg-green-500/10 text-green-500";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

  const getImpactLevelColor = (level: string) => {
    switch (level) {
      case "high": return "bg-red-500/10 text-red-500";
      case "medium": return "bg-orange-500/10 text-orange-500";
      case "low": return "bg-yellow-500/10 text-yellow-500";
      default: return "bg-gray-500/10 text-gray-500";
    }
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
              <span className="text-lg font-semibold text-foreground">{t('settings.title')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
              <RotateCcw className="w-4 h-4 mr-2" />
              {t('common.reset')}
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges}>
              <Save className="w-4 h-4 mr-2" />
              {t('settings.saveSettings')}
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
                <CardTitle>{t('settings.appearance')}</CardTitle>
              </div>
              <CardDescription>Customize how the application looks and displays information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="theme">{t('settings.theme')}</Label>
                  <Select value={settings.theme} onValueChange={(v: "light" | "dark" | "system") => updateSetting("theme", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('settings.theme')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t('settings.light')}</SelectItem>
                      <SelectItem value="dark">{t('settings.dark')}</SelectItem>
                      <SelectItem value="system">{t('settings.system')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">{t('settings.currency')}</Label>
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
                  <Label htmlFor="dateFormat">{t('settings.dateFormat')}</Label>
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
                  <Label htmlFor="language">{t('settings.language')}</Label>
                  <Select value={settings.language} onValueChange={(v) => updateSetting("language", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('settings.selectLanguage')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ro">Română</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
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
                <CardTitle>{t('settings.inventory')}</CardTitle>
              </div>
              <CardDescription>Configure stock thresholds and reorder preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="lowStock">{t('settings.lowStockThreshold')}</Label>
                  <Input
                    id="lowStock"
                    type="number"
                    min="1"
                    value={settings.lowStockThreshold}
                    onChange={(e) => updateSetting("lowStockThreshold", parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">Alert when stock falls below this level</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="criticalStock">{t('settings.criticalStockThreshold')}</Label>
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
                  <Label htmlFor="leadTime">{t('settings.defaultLeadTime')}</Label>
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
                      <Label>{t('settings.autoReorder')}</Label>
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
                <CardTitle>{t('settings.notifications')}</CardTitle>
              </div>
              <CardDescription>Manage your alert and notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>{t('settings.lowStockAlerts')}</Label>
                  <p className="text-sm text-muted-foreground">Notify when items reach low stock threshold</p>
                </div>
                <Switch checked={settings.lowStockAlerts} onCheckedChange={(v) => updateSetting("lowStockAlerts", v)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>{t('settings.orderConfirmations')}</Label>
                  <p className="text-sm text-muted-foreground">Confirm when purchase orders are created</p>
                </div>
                <Switch checked={settings.orderConfirmations} onCheckedChange={(v) => updateSetting("orderConfirmations", v)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>{t('settings.dailySummary')}</Label>
                  <p className="text-sm text-muted-foreground">Receive a daily inventory summary</p>
                </div>
                <Switch checked={settings.dailySummary} onCheckedChange={(v) => updateSetting("dailySummary", v)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>{t('settings.emailNotifications')}</Label>
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
                <CardTitle>{t('settings.pricing')}</CardTitle>
              </div>
              <CardDescription>Configure tax rates and pricing defaults</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="taxRate">{t('settings.taxRate')}</Label>
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
                  <Label htmlFor="markup">{t('settings.defaultMarkup')}</Label>
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

          {/* Holidays & Events Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <CardTitle>Holidays & Special Events</CardTitle>
                    <CardDescription>Manage holidays and events for better forecasting</CardDescription>
                  </div>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => handleOpenDialog()} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Holiday
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[525px]">
                    <DialogHeader>
                      <DialogTitle>{editingHoliday ? "Edit Holiday" : "Add New Holiday"}</DialogTitle>
                      <DialogDescription>
                        Configure holidays and events that affect sales forecasting
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Event Name *</Label>
                        <Input
                          id="name"
                          value={holidayForm.name}
                          onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                          placeholder="e.g., Black Friday, Christmas"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="event_type">Event Type *</Label>
                          <Select
                            value={holidayForm.event_type}
                            onValueChange={(v: any) => setHolidayForm({ ...holidayForm, event_type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="public_holiday">Public Holiday</SelectItem>
                              <SelectItem value="shopping_event">Shopping Event</SelectItem>
                              <SelectItem value="seasonal">Seasonal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="impact_level">Impact Level *</Label>
                          <Select
                            value={holidayForm.impact_level}
                            onValueChange={(v: any) => setHolidayForm({ ...holidayForm, impact_level: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="date">Date *</Label>
                          <Input
                            id="date"
                            type="date"
                            value={holidayForm.date ? holidayForm.date.split('T')[0] : ''}
                            onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="market">Market</Label>
                          <Input
                            id="market"
                            value={holidayForm.market}
                            onChange={(e) => setHolidayForm({ ...holidayForm, market: e.target.value })}
                            placeholder="Germany"
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="demand_change">Demand Change Multiplier</Label>
                        <Input
                          id="demand_change"
                          type="number"
                          step="0.1"
                          value={holidayForm.typical_demand_change || 0}
                          onChange={(e) => setHolidayForm({ ...holidayForm, typical_demand_change: parseFloat(e.target.value) })}
                          placeholder="e.g., 2.0 for +100%, 0.5 for -50%"
                        />
                        <p className="text-xs text-muted-foreground">
                          Multiplier for demand (1.0 = no change, 2.0 = double, 0.5 = half)
                        </p>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="categories">Affected Categories (comma-separated)</Label>
                        <Input
                          id="categories"
                          value={holidayForm.affected_categories?.join(", ") || ""}
                          onChange={(e) => setHolidayForm({
                            ...holidayForm,
                            affected_categories: e.target.value.split(",").map(c => c.trim()).filter(Boolean)
                          })}
                          placeholder="e.g., Electronics, Clothing, Food"
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty to affect all categories
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveHoliday}>
                        {editingHoliday ? "Update" : "Create"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loadingHolidays ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : holidays.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No holidays configured yet</p>
                  <p className="text-sm">Add holidays to improve forecast accuracy</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {holidays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((holiday) => (
                    <div key={holiday.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{holiday.name}</h4>
                          <Badge className={getEventTypeColor(holiday.event_type)} variant="secondary">
                            {getEventTypeLabel(holiday.event_type)}
                          </Badge>
                          <Badge className={getImpactLevelColor(holiday.impact_level)} variant="secondary">
                            {holiday.impact_level}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>📅 {new Date(holiday.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                          <span>🌍 {holiday.market}</span>
                          {holiday.typical_demand_change && (
                            <span>📈 {holiday.typical_demand_change > 1 ? '+' : ''}{((holiday.typical_demand_change - 1) * 100).toFixed(0)}%</span>
                          )}
                          {holiday.affected_categories && holiday.affected_categories.length > 0 && (
                            <span>🏷️ {holiday.affected_categories.join(", ")}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(holiday)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteHoliday(holiday.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;