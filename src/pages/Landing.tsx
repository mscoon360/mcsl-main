import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3, Users, Package, FileText, Building2, Truck, CreditCard, ChevronDown,
  DollarSign, Receipt, ShoppingCart, ScanBarcode, BookOpen, Scale, Tag, Wrench,
  Fuel, Briefcase, GraduationCap, FileCheck, HardHat, Microscope, Megaphone,
  ClipboardList, Calculator, ScanText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import magicCareLogo from "@/assets/magic-care-logo.png";

type Link = { name: string; href: string };
type Section = { title: string; icon: any; links: Link[] };

const sections: Section[] = [
  {
    title: "Main",
    icon: ScanText,
    links: [
      { name: "Data Extractor (Coming Soon)", href: "/data-extractor" },
      { name: "Fulfillment", href: "/fulfillment" },
      { name: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Group Supporting Departments",
    icon: Briefcase,
    links: [
      { name: "Legal Dept.", href: "/group-legal" },
      { name: "Finance Dept.", href: "/group-finance" },
      { name: "Human Resource Dept.", href: "/group-hr" },
      { name: "Learning & Development Dept.", href: "/group-learning" },
      { name: "Policies & Standard Dept.", href: "/group-policies" },
      { name: "HSSE Dept.", href: "/group-hsse" },
      { name: "Research Development & A.I Dept.", href: "/group-research" },
      { name: "Marketing Dept.", href: "/group-marketing" },
    ],
  },
  {
    title: "Finance Department",
    icon: DollarSign,
    links: [
      { name: "Overview", href: "/finance" },
      { name: "Income", href: "/income" },
      { name: "Accounts Receivable", href: "/accounts-receivable" },
      { name: "Invoices", href: "/invoices" },
      { name: "Expenditure", href: "/expenditure" },
      { name: "Accounts Payable", href: "/accounts-payable" },
      { name: "Vendors", href: "/vendors" },
      { name: "Product/Service Costing", href: "/sales-products" },
      { name: "Rental Costing", href: "/rental-costing" },
      { name: "Service Costing", href: "/service-costing" },
      { name: "Chart of Accounts", href: "/chart-of-accounts" },
      { name: "Account Mappings", href: "/account-mappings" },
      { name: "Trial Balance", href: "/trial-balance" },
      { name: "Reports", href: "/finance-reports" },
      { name: "Asset Registrar", href: "/asset-registrar" },
      { name: "Receivables", href: "/rental-payments" },
      { name: "Purchase Orders", href: "/finance-purchase-orders" },
    ],
  },
  {
    title: "Procurement & Logistics Department",
    icon: Truck,
    links: [
      { name: "Inventory", href: "/products" },
      { name: "Services", href: "/services" },
      { name: "Supplier Listing", href: "/suppliers" },
      { name: "Purchase Orders", href: "/purchase-orders" },
      { name: "Barcode Scanner", href: "/barcode-scanner" },
      { name: "Fleet Management", href: "/fleet" },
      { name: "Inspections", href: "/inspections" },
      { name: "Driver Companion", href: "/companion" },
      { name: "Fuel Records", href: "/fuel" },
      { name: "Parts & Maintenance", href: "/parts" },
      { name: "Driver Management", href: "/driver-management" },
      { name: "Alerts & Automations", href: "/alerts-automations" },
    ],
  },
  {
    title: "Divisional Sales & Contracts Department",
    icon: ShoppingCart,
    links: [
      { name: "Point of Sale", href: "/pos" },
      { name: "Pending Invoices", href: "/sales" },
      { name: "Product Listing", href: "/product-listing" },
      { name: "Promotions", href: "/promotions" },
      { name: "Contracts", href: "/rental-agreements" },
      { name: "Customer Database", href: "/customers" },
    ],
  },
  {
    title: "Operational Divisions",
    icon: Wrench,
    links: [
      { name: "Maintenance", href: "/maintenance" },
      { name: "Schedule", href: "/schedule" },
    ],
  },
];

export default function Landing() {
  const { user } = useAuth();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4">
      <header className="flex flex-col items-center text-center gap-4">
        <img
          src={magicCareLogo}
          alt="Magic Care Services Limited logo"
          className="h-24 w-auto object-contain"
        />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Magic Care Services Limited
          </h1>
          <p className="text-muted-foreground mt-1">
            {user?.email ? `Welcome back, ${user.email}` : "Welcome back"} — select a department to get started.
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          const isOpen = !!open[section.title];
          return (
            <Collapsible
              key={section.title}
              open={isOpen}
              onOpenChange={(v) => setOpen((p) => ({ ...p, [section.title]: v }))}
            >
              <Card className="h-full">
                <CollapsibleTrigger className="w-full text-left">
                  <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-5 w-5 text-primary" />
                      {section.title}
                    </CardTitle>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <ul className="space-y-1">
                      {section.links.map((link) => (
                        <li key={link.href + link.name}>
                          <Link
                            to={link.href}
                            className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            {link.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
