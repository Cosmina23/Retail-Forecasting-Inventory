import { useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package } from "lucide-react";

const initialProducts = [
  { sku: "EL-001", name: "Samsung Galaxy S23", stock: 45, safetyStock: 20, status: "in-stock" },
  { sku: "EL-002", name: "Apple iPhone 15 Pro", stock: 12, safetyStock: 15, status: "low-stock" },
  { sku: "CL-001", name: "Nike Air Max 90", stock: 67, safetyStock: 30, status: "in-stock" },
  { sku: "CL-002", name: "Levi's 501 Jeans", stock: 8, safetyStock: 25, status: "low-stock" },
  { sku: "HO-001", name: "Philips Air Purifier", stock: 23, safetyStock: 10, status: "in-stock" },
  { sku: "HO-002", name: "Dyson V15 Vacuum", stock: 5, safetyStock: 8, status: "low-stock" },
  { sku: "EL-003", name: "Sony WH-1000XM5", stock: 34, safetyStock: 15, status: "in-stock" },
  { sku: "CL-003", name: "Adidas Ultraboost", stock: 52, safetyStock: 20, status: "in-stock" },
];

const Inventory = () => {
  const [products, setProducts] = useState(initialProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    sku: "",
    name: "",
    stock: "",
    safetyStock: "",
  });

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddProduct = () => {
    const product = {
      sku: newProduct.sku,
      name: newProduct.name,
      stock: parseInt(newProduct.stock),
      safetyStock: parseInt(newProduct.safetyStock),
      status: parseInt(newProduct.stock) > parseInt(newProduct.safetyStock) ? "in-stock" : "low-stock",
    };
    setProducts([...products, product]);
    setNewProduct({ sku: "", name: "", stock: "", safetyStock: "" });
    setIsDialogOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search product or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    placeholder="e.g., EL-004"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productName">Product Name</Label>
                  <Input
                    id="productName"
                    placeholder="e.g., Apple MacBook Pro"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock Level</Label>
                    <Input
                      id="stock"
                      type="number"
                      placeholder="0"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="safetyStock">Safety Stock</Label>
                    <Input
                      id="safetyStock"
                      type="number"
                      placeholder="0"
                      value={newProduct.safetyStock}
                      onChange={(e) => setNewProduct({ ...newProduct, safetyStock: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="hero" onClick={handleAddProduct}>
                  Add Product
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <div className="bg-card border rounded-xl overflow-hidden animate-fade-up">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">SKU</TableHead>
                <TableHead className="font-semibold">Product Name</TableHead>
                <TableHead className="font-semibold text-right">Stock Level</TableHead>
                <TableHead className="font-semibold text-right">Safety Stock</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.sku} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {product.sku}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{product.stock}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{product.safetyStock}</TableCell>
                  <TableCell>
                    <Badge
                      variant={product.status === "in-stock" ? "default" : "destructive"}
                      className={
                        product.status === "in-stock"
                          ? "bg-success/10 text-success hover:bg-success/20"
                          : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                      }
                    >
                      {product.status === "in-stock" ? "In Stock" : "Low Stock"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredProducts.length === 0 && (
            <div className="py-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No products found</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Inventory;
