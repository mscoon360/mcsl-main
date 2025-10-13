import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Customers from "./pages/Customers";
import Products from "./pages/Products";
import ProductBarcodes from "./pages/ProductBarcodes";
import BarcodeScanner from "./pages/BarcodeScanner";
import RentalAgreements from "./pages/RentalAgreements";
import RentalPayments from "./pages/RentalPayments";
import Fulfillment from "./pages/Fulfillment";
import FinanceOverview from "./pages/FinanceOverview";
import Income from "./pages/Income";
import Expenditure from "./pages/Expenditure";
import Invoices from "./pages/Invoices";
import Auth from "./pages/Auth";
import ChangePassword from "./pages/ChangePassword";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="sales" element={<Sales />} />
              <Route path="customers" element={<Customers />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:productId/barcodes" element={<ProductBarcodes />} />
            <Route path="barcode-scanner" element={<BarcodeScanner />} />
            <Route path="rental-agreements" element={<RentalAgreements />} />
              <Route path="rental-payments" element={<RentalPayments />} />
              <Route path="fulfillment" element={<Fulfillment />} />
              <Route path="finance" element={<FinanceOverview />} />
              <Route path="income" element={<Income />} />
              <Route path="expenditure" element={<Expenditure />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="admin" element={<Admin />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
