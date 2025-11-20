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
import Inventory from "./pages/Inventory";
import ProductBarcodes from "./pages/ProductBarcodes";
import BarcodeScanner from "./pages/BarcodeScanner";
import DataExtractor from "./pages/DataExtractor";
import RentalAgreements from "./pages/RentalAgreements";
import RentalPayments from "./pages/RentalPayments";
import Fulfillment from "./pages/Fulfillment";
import FinanceOverview from "./pages/FinanceOverview";
import Income from "./pages/Income";
import Expenditure from "./pages/Expenditure";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import TrialBalance from "./pages/TrialBalance";
import AccountsPayable from "./pages/AccountsPayable";
import AccountsReceivable from "./pages/AccountsReceivable";
import Vendors from "./pages/Vendors";
import Invoices from "./pages/Invoices";
import Auth from "./pages/Auth";
import ChangePassword from "./pages/ChangePassword";
import Admin from "./pages/Admin";
import Promotions from "./pages/Promotions";
import Maintenance from "./pages/Maintenance";
import Schedule from "./pages/Schedule";
import Fleet from "./pages/Fleet";
import Companion from "./pages/Companion";
import Inspections from "./pages/Inspections";
import Fuel from "./pages/Fuel";
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
            <Route path="inventory" element={<Inventory />} />
            <Route path="products/:productId/barcodes" element={<ProductBarcodes />} />
            <Route path="barcode-scanner" element={<BarcodeScanner />} />
            <Route path="data-extractor" element={<DataExtractor />} />
            <Route path="rental-agreements" element={<RentalAgreements />} />
              <Route path="rental-payments" element={<RentalPayments />} />
              <Route path="fulfillment" element={<Fulfillment />} />
              <Route path="finance" element={<FinanceOverview />} />
              <Route path="income" element={<Income />} />
              <Route path="expenditure" element={<Expenditure />} />
              <Route path="chart-of-accounts" element={<ChartOfAccounts />} />
              <Route path="trial-balance" element={<TrialBalance />} />
              <Route path="accounts-payable" element={<AccountsPayable />} />
              <Route path="accounts-receivable" element={<AccountsReceivable />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="promotions" element={<Promotions />} />
              <Route path="maintenance" element={<Maintenance />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="fleet" element={<Fleet />} />
              <Route path="inspections" element={<Inspections />} />
              <Route path="companion" element={<Companion />} />
              <Route path="fuel" element={<Fuel />} />
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
