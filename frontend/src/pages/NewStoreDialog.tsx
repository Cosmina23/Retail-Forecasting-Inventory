import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiService } from "@/services/api";

interface NewStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStoreCreated: () => void;
}

export function NewStoreDialog({ open, onOpenChange, onStoreCreated }: NewStoreDialogProps) {
  // Adăugăm market și address în starea formularului conform modelului StoreCreate
  const [formData, setFormData] = useState({ name: "", market: "", address: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      // Trimitem obiectul cu toate cele 3 câmpuri obligatorii
      await apiService.createStore(formData);
      onStoreCreated();
      onOpenChange(false);
      setFormData({ name: "", market: "", address: "" });
    } catch (err: any) {
      // REPARAȚIE: Parsăm lista de erori de la FastAPI pentru a evita [object Object]
      const detail = err.response?.data?.detail;

      if (Array.isArray(detail)) {
        // Unim mesajele de eroare (ex: "market: field required") într-un singur string lizibil
        const messages = detail.map((e: any) => `${e.loc[1]}: ${e.msg}`);
        setError(messages.join(" | "));
      } else {
        setError(detail || "An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Store</DialogTitle>
          <p className="text-sm text-muted-foreground">Please fill in all required fields.</p>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Store Name</Label>
            <Input
              id="name"
              placeholder="e.g. Tech Haven Store"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="market">Market Type</Label>
            <Input
              id="market"
              placeholder="e.g. Retail, Electronics"
              value={formData.market}
              onChange={(e) => setFormData({...formData, market: e.target.value})}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">Full Address</Label>
            <Input
              id="address"
              placeholder="Street, City, Country"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
            />
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-[10px] p-2 rounded-md border border-destructive/20 font-mono">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? "Creating..." : "Create Store"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}