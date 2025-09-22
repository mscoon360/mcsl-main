import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Customers from "./pages/Customers";
import Products from "./pages/Products";
import RentalAgreements from "./pages/RentalAgreements";
import RentalPayments from "./pages/RentalPayments";
import Fulfillment from "./pages/Fulfillment";
import FinanceOverview from "./pages/FinanceOverview";
import Income from "./pages/Income";
import Expenditure from "./pages/Expenditure";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="sales" element={<Sales />} />
            <Route path="customers" element={<Customers />} />
            <Route path="products" element={<Products />} />
            <Route path="rental-agreements" element={<RentalAgreements />} />
            <Route path="rental-payments" element={<RentalPayments />} />
            <Route path="fulfillment" element={<Fulfillment />} />
            <Route path="finance" element={<FinanceOverview />} />
            <Route path="income" element={<Income />} />
            <Route path="expenditure" element={<Expenditure />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
