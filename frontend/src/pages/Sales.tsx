import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Package } from "lucide-react";
import apiService from "@/services/api";


const Sales = () => {
  const { toast } = useToast();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [days, setDays] = useState<number | undefined>(30);
  const [storeFilter, setStoreFilter] = useState<string | undefined>(undefined);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [appliedFrom, setAppliedFrom] = useState<string>("");
  const [appliedTo, setAppliedTo] = useState<string>("");
  const [productNames, setProductNames] = useState<{[id: string]: string}>({});
  const [storeNames, setStoreNames] = useState<{[id: string]: string}>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  // Fetch product and store names for all visible sales
  useEffect(() => {
    const fetchNames = async () => {
      const prodIds = Array.from(new Set(sales.map(s => s.product_id).filter(Boolean)));
      const storeIds = Array.from(new Set(sales.map(s => s.store_id).filter(Boolean)));
      const prodMap: {[id: string]: string} = {...productNames};
      const storeMap: {[id: string]: string} = {...storeNames};

      for (const pid of prodIds) {
        if (!prodMap[pid]) {
          try {
            const prod = await apiService.getProduct(pid);
            console.log(`Fetched product for ID ${pid}: with name ${prod.name}`, prod);
            prodMap[pid] = prod.name ;
          } catch (error) {
            console.error(`Failed to fetch product for ID ${pid}:`, error);
            prodMap[pid] = pid;
          }
        }
      }

      for (const sid of storeIds) {
        if (!storeMap[sid]) {
          try {
            const store = await apiService.getStore(sid);
            console.log(`Fetched store for ID ${sid}:`, store);
            storeMap[sid] = store.name || sid;
          } catch (error) {
            console.error(`Failed to fetch store for ID ${sid}:`, error);
            storeMap[sid] = sid;
          }
        }
      }

      setProductNames(prodMap);
      setStoreNames(storeMap);
    };
    if (sales.length) fetchNames();
    // eslint-disable-next-line
  }, [sales]);
  // Handle sales file upload
  const handleSalesUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
          // Optionally, you can pass storeId to the backend if your import endpoint supports it
          const store_id = localStorage.getItem('store_id');
          const result = await apiService.importSales(uploadFile,store_id);
          const imported = result.inserted_or_updated ?? result.inserted_count ?? 0;
          const errorCount = Array.isArray(result.errors) ? result.errors.length : 0;
          toast({
            title: "Success!",
            description: `Imported ${imported} sales successfully${errorCount ? `, ${errorCount} rows had issues` : ""}`,
          });
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Upload failed",
            description: error.message || "Could not upload file",
          });
        } finally {
          setUploading(false);
        }
  };


  useEffect(() => {
    fetchSales();
    // eslint-disable-next-line
  }, [days]);


  const fetchSales = async () => {
    setLoading(true);
    try {
      const data = await apiService.getSales(0, 100, days ?? undefined);
      const list = Array.isArray(data) ? data : data?.sales || [];
      setSales(list);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to load sales",
        description: error.message || "Could not fetch sales data",
      });
    } finally {
      setLoading(false);
    }
  };


  const filteredSales = useMemo(() => {
    const term = search.toLowerCase();
    const from = appliedFrom ? new Date(appliedFrom) : undefined;
    const to = appliedTo ? new Date(appliedTo) : undefined;
    if (to) {
      to.setHours(23, 59, 59, 999); // inclusive end of day
    }
    return sales.filter((sale) => {
      const matchesSearch = !term ||
        sale.product_name?.toLowerCase().includes(term) ||
        sale.sku?.toLowerCase().includes(term);
      const matchesStore = !storeFilter || sale.store_id === storeFilter;
      const dateVal = sale.sale_date || sale.date;
      const saleDt = dateVal ? new Date(dateVal) : undefined;
      const matchesDate = (!from || (saleDt && saleDt >= from)) && (!to || (saleDt && saleDt <= to));
      return matchesSearch && matchesStore && matchesDate;
    });
  }, [sales, search, storeFilter, appliedFrom, appliedTo]);


  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default">Import Sales</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Sales File</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-2">
                    <Input type="file" accept=".csv,.xlsx,.xls" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                  </div>
                  <DialogFooter>
                    <Button onClick={handleSalesUpload} disabled={uploading || !uploadFile}>
                      {uploading ? "Uploading..." : "Upload"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground flex items-center gap-2">
                  Show last
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={days ?? "all"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDays(val === "all" ? undefined : Number(val));
                    }}
                  >
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                    <option value={180}>180 days</option>
                    <option value="all">All time</option>
                  </select>
                </label>
              </div>
              <Input
                placeholder="Search by product or SKU"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Store</span>
                <Input
                  value={storeFilter || ""}
                  onChange={(e) => setStoreFilter(e.target.value || undefined)}
                  placeholder="store_id"
                  className="w-48"
                />
                <Button variant="outline" size="sm" onClick={() => setStoreFilter(localStorage.getItem("store_id") || undefined)}>
                  Use my store
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setStoreFilter(undefined)}>
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">From</span>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-44" />
                <span className="text-muted-foreground">To</span>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-44" />
                <Button variant="default" size="sm" onClick={() => { setAppliedFrom(fromDate); setAppliedTo(toDate); }}>Apply</Button>
                <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDate(""); setAppliedFrom(""); setAppliedTo(""); }}>Reset dates</Button>
              </div>
            </div>
            <div className="bg-card rounded-xl border shadow-card p-6">
              {loading ? (
                <div className="py-12 text-center">
                  <span className="flex justify-center"><Package className="w-8 h-8 text-muted-foreground/50 mb-3" /></span>
                  <p className="text-muted-foreground">Loading sales...</p>
                </div>
              ) : filteredSales.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="flex justify-center"><Package className="w-8 h-8 text-muted-foreground/50 mb-3" /></span>
                  <p className="text-muted-foreground">No sales found for the selected range.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale, idx) => (
                      <TableRow key={sale.id || sale._id || idx}>
                        <TableCell>{sale.sale_date ? new Date(sale.sale_date).toLocaleDateString() : "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{ productNames[sale.product_id] || sale.product_id}</Badge>
                        </TableCell>
                        <TableCell>{sale.sku || "-"}</TableCell>
                        <TableCell>{storeNames[sale.store_id] || sale.store_name || sale.store_id || "-"}</TableCell>
                        <TableCell>{sale.quantity ?? "-"}</TableCell>
                        <TableCell>{
                          sale.total_amount !== undefined && sale.total_amount !== null
                            ? `$${Number(sale.total_amount).toFixed(2)}`
                            : sale.total !== undefined && sale.total !== null
                              ? `$${Number(sale.total).toFixed(2)}`
                              : "-"
                        }</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Sales;
