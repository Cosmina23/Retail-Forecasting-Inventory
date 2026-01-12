import { useEffect, useState } from "react";
import { apiService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const Sales = () => {
  const { toast } = useToast();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    try {
      // You may want to filter by store or user
      const data = await apiService.getSales();
      setSales(data);
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

  const filteredSales = sales.filter(
    (sale) =>
      sale.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      sale.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Sales</h1>
        <Input
          placeholder="Search by product or SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </div>
      <div className="bg-card rounded-xl border shadow-card p-6">
        {loading ? (
          <div>Loading sales...</div>
        ) : filteredSales.length === 0 ? (
          <div>No sales found.</div>
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
              {filteredSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>{sale.date ? new Date(sale.date).toLocaleDateString() : "-"}</TableCell>
                  <TableCell>{sale.product_name || sale.product_id}</TableCell>
                  <TableCell>{sale.sku}</TableCell>
                  <TableCell>{sale.store_name || sale.store_id}</TableCell>
                  <TableCell>{sale.quantity}</TableCell>
                  <TableCell>{sale.total ? `$${sale.total.toFixed(2)}` : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default Sales;
