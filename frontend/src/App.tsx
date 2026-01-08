import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Setup from "./pages/Setup";
import ShopSelector from "./pages/ShopSelector";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Forecasting from "./pages/Forecasting";
import History from "./pages/History";
import PurchaseOrders from "./pages/PurchaseOrders";
import ProductImport from "./pages/ProductImport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/index" element={<ShopSelector />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/product-import" element={<ProductImport />} />
          <Route path="/forecasting" element={<Forecasting />} />
          <Route path="/purchase-orders" element={<PurchaseOrders />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
