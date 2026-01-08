import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Store, Plus, TrendingUp, LogOut, Settings, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { storesApi, Store as StoreType } from "@/services/api";
import { NewStoreDialog } from "@/components/NewStoreDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ShopSelector = () => {
  const navigate = useNavigate();
  const [shops, setShops] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewStoreDialogOpen, setIsNewStoreDialogOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<StoreType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    const timeoutId = setTimeout(() => {
      setError("Request timeout - backend is not responding. Is it running?");
      setLoading(false);
    }, 10000);

    try {
      setLoading(true);
      setError(null);
      console.log("Fetching stores from API...");
      console.log("API Base URL:", import.meta.env.VITE_API_URL || 'http://localhost:8000');

      const data = await storesApi.getAllStores();

      clearTimeout(timeoutId);
      console.log("Stores received:", data);
      setShops(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      clearTimeout(timeoutId);
      const errorMessage = err instanceof Error ? err.message : "Failed to load stores. Please try again.";
      console.error("Error fetching stores:", err);
      console.error("Full error object:", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleStoreCreated = () => {
    fetchStores();
  };

  const handleDeleteStore = async (store: StoreType) => {
    setIsDeleting(true);
    try {
      const storeId = store._id || store.id;
      if (!storeId) {
        throw new Error("Store ID not found");
      }

      await storesApi.deleteStore(storeId);

      // Reîncarcă lista de magazine
      await fetchStores();

      // Închide dialogul
      setStoreToDelete(null);
    } catch (err) {
      console.error("Error deleting store:", err);
      setError(err instanceof Error ? err.message : "Failed to delete store");
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
            <Button variant="ghost" size="icon">
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
          <Button variant="hero" onClick={() => setIsNewStoreDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Store
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
            <p className="font-semibold mb-1">Error Loading Stores</p>
            <p className="text-sm mb-2">{error}</p>
            <details className="text-xs mt-2">
              <summary className="cursor-pointer hover:underline">Troubleshooting</summary>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Make sure backend is running on: {import.meta.env.VITE_API_URL || 'http://localhost:8000'}</li>
                <li>Check if CORS is enabled in backend</li>
                <li>Verify the endpoint exists in backend/stores.py</li>
              </ul>
            </details>
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setShops([]);
                }}
              >
                Continue Without Stores
              </Button>
            </div>
          </div>
        )}

        {/* Shop Grid */}
        {!loading && !error && (
          <>
            {shops.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-full bg-accent/50 flex items-center justify-center mb-4">
                  <Store className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No Stores Yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Get started by creating your first store to manage inventory and track sales.
                </p>
                <Button variant="hero" onClick={() => setIsNewStoreDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Create Your First Store
                </Button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {shops.map((shop, index) => (
                  <div
                    key={shop._id || shop.id}
                    onClick={() => {
                      const id = shop._id || shop.id;
                      try {
                        localStorage.setItem("selectedStore", JSON.stringify(shop));
                      } catch (e) {
                        console.warn("Could not save selectedStore", e);
                      }
                      if (id) navigate(`/dashboard/${id}`);
                      else navigate("/index");
                    }}
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

                    {shop.revenue && (
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                        <TrendingUp className="w-4 h-4 text-success" />
                        <span className="text-sm text-muted-foreground">Daily Revenue:</span>
                        <span className="text-sm font-semibold text-foreground ml-auto">
                          {formatCurrency(shop.revenue)}
                        </span>
                      </div>
                    )}

                    {/* Delete Store Button */}
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStoreToDelete(shop);
                        }}
                      >
                        <Trash2 className="w-5 h-5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <NewStoreDialog
        open={isNewStoreDialogOpen}
        onOpenChange={setIsNewStoreDialogOpen}
        onStoreCreated={handleStoreCreated}
      />

      {/* Delete Store Confirmation Dialog */}
      <AlertDialog open={!!storeToDelete} onOpenChange={(open) => {
        if (!open) setStoreToDelete(null);
      }}>
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
            <AlertDialogCancel onClick={() => setStoreToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (storeToDelete) handleDeleteStore(storeToDelete);
              }}
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
