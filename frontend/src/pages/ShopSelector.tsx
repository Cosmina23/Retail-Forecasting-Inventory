import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Store, Plus, TrendingUp, LogOut, Settings, Loader2, Trash2, Building2 } from "lucide-react";
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

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    setLoading(true);
    try {
      const data = await apiService.getMyStores();
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
  };

  const handleDeleteStore = async (store: any) => {
    setIsDeleting(true);
    try {
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
    <div className="min-h-screen bg-slate-50"> {/* Fundalul albastru deschis/slate original */}
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10 shadow-sm">
        <div className="container max-w-7xl py-4 flex items-center justify-between">
          <div className="flex items-center">
            <img
              src="/photos/stok_no_bg.png"
              alt="App Logo"
              className="h-12 w-auto object-contain cursor-pointer transition-transform hover:scale-105"
              onClick={() => navigate("/index")}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary" onClick={() => navigate("/settings")}>
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-destructive" onClick={() => navigate("/")}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-7xl py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Your Portfolio</h1>
          <p className="text-slate-500 mt-1">Select a workspace to continue.</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-primary opacity-30" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* CARD: NEW STORE (Dashed) */}
            <div
              onClick={() => setIsDialogOpen(true)}
              className="group border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary hover:bg-white hover:shadow-xl hover:shadow-primary/5 transition-all min-h-[180px] animate-fade-up bg-slate-50/50"
            >
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:bg-primary transition-colors">
                <Plus className="w-6 h-6 text-slate-400 group-hover:text-white transition-colors" />
              </div>
              <p className="font-semibold text-slate-500 group-hover:text-primary transition-colors">Add New Store</p>
            </div>

            {/* LISTA MAGAZINE */}
            {shops.map((shop, index) => (
              <div
                key={shop.id || shop._id}
                onClick={() => {
                  localStorage.setItem("selectedStore", JSON.stringify(shop));
                  navigate(`/dashboard/${shop.id || shop._id}`);
                }}
                className="bg-white border border-slate-100 rounded-2xl p-6 cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all animate-fade-up relative group"
                style={{ animationDelay: `${(index + 1) * 0.05}s` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 group-hover:text-primary transition-colors">
                        {shop.name}
                      </h3>
                      <p className="text-xs font-medium text-slate-400">{shop.market || "General Retail"}</p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-300 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStoreToDelete(shop);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-medium text-slate-400 uppercase">Live</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Weekly revenue</p>
                    <p className="text-sm font-bold text-slate-700">{formatCurrency(shop.revenue || 0)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <NewStoreDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onStoreCreated={handleStoreCreated}
      />

      <AlertDialog open={!!storeToDelete} onOpenChange={(open) => !open && setStoreToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Store?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "<strong>{storeToDelete?.name}</strong>"? This action is permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => storeToDelete && handleDeleteStore(storeToDelete)}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ShopSelector;