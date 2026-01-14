import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
// Am adăugat Trash2 în listă
import { Store, Plus, TrendingUp, LogOut, Settings, Loader2, Trash2 } from "lucide-react";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { NewStoreDialog } from "./NewStoreDialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const ShopSelector = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Starea pentru deschiderea pop-up-ului de magazin nou
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Starea pentru confirmarea ștergerii
  const [storeToDelete, setStoreToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getMyStores();
      // Normalize response: apiService.getMyStores may return { stores: [...] } or an array
      const shopsArray = Array.isArray(data) ? data : data?.stores ?? [];
      setShops(shopsArray);
    } catch (error: any) {
      setError(error?.message || String(error));
      toast({
        variant: "destructive",
        title: "Failed to load stores",
        description: error.message || "Could not fetch stores",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStoreCreated = () => {
    setIsDialogOpen(false);
    fetchShops();
    toast({ title: "Store created", description: "Store was created successfully." });
  };

  const handleDeleteStore = async (store: any) => {
    setIsDeleting(true);
    try {
      // API call pentru ștergere folosind ID-ul magazinului
      await apiService.deleteStore(store.id || store._id);
      setStoreToDelete(null);
      fetchShops();
      toast({ title: "Store deleted", description: "Store was deleted successfully." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Delete failed", description: err?.message || String(err) });
    } finally {
      setIsDeleting(false);
    }
  };

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
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
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

          <Button variant="hero" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Store
          </Button>
        </div>

        <NewStoreDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onStoreCreated={handleStoreCreated}
        />

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {!loading && shops.map((shop: any, index: number) => (
            <div
              key={shop.id || shop._id}
              onClick={() => {
                localStorage.setItem("selectedStore", JSON.stringify(shop));
                navigate(`/dashboard/${shop.id || shop._id}`);
              }}
              className="bg-card border rounded-xl p-6 cursor-pointer card-hover shadow-card animate-fade-up relative group"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center">
                    <Store className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground mb-1">{shop.name}</h3>
                    <p className="text-xs text-muted-foreground">{shop.market || "General Retail"}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-success" />
                    <span className="text-xs text-muted-foreground capitalize">Online</span>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStoreToDelete(shop);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-sm text-muted-foreground">Revenue:</span>
                <span className="text-sm font-semibold text-foreground ml-auto">
                  {formatCurrency(shop.revenue || 0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Dialog Confirmare Ștergere */}
      <AlertDialog open={!!storeToDelete} onOpenChange={(open) => !open && setStoreToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              {storeToDelete && (
                <>Are you sure you want to delete the store "<strong>{storeToDelete.name}</strong>"? This action cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => storeToDelete && handleDeleteStore(storeToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Store"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ShopSelector;