import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { 
  BarChart3, 
  Users, 
  Package, 
  FileText, 
  Settings,
  Building2,
  Truck,
  CreditCard,
  ChevronDown,
  DollarSign,
  Receipt,
  ShoppingCart,
  Shield,
  LogOut,
  ScanBarcode,
  Warehouse,
  ScanText,
  BookOpen,
  FileInput,
  FileOutput,
  Scale,
  Tag,
  Wrench,
  ClipboardCheck,
  Fuel,
  Briefcase,
  GraduationCap,
  FileCheck,
  HardHat,
  Microscope,
  Megaphone,
} from "lucide-react";
import magicCareLogo from "@/assets/magic-care-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type NavigationItem = {
  name: string;
  icon: any;
  href?: string;
  subItems?: { name: string; href: string }[];
};

type NavigationSection = {
  title: string;
  items: NavigationItem[];
};

const navigation: NavigationSection[] = [
  {
    title: "Main",
    items: [
      { name: "Data Extractor (Coming Soon)", href: "/data-extractor", icon: ScanText },
      { name: "Fulfillment", href: "/fulfillment", icon: Truck },
    ]
  },
  {
    title: "Group Supporting Departments",
    items: [
      { name: "Legal Dept.", href: "/group-legal", icon: Scale },
      { name: "Finance Dept.", href: "/group-finance", icon: DollarSign },
      { name: "Human Resource Dept.", href: "/group-hr", icon: Users },
      { name: "Learning & Development Dept.", href: "/group-learning", icon: GraduationCap },
      { name: "Policies & Standard Dept.", href: "/group-policies", icon: FileCheck },
      { name: "HSSE Dept.", href: "/group-hsse", icon: HardHat },
      { name: "Research Development & A.I Dept.", href: "/group-research", icon: Microscope },
      { name: "Marketing Dept.", href: "/group-marketing", icon: Megaphone },
    ]
  },
  {
    title: "Finance Department",
    items: [
      { name: "Overview", href: "/finance", icon: BarChart3 },
      { 
        name: "Income", 
        icon: DollarSign,
        subItems: [
          { name: "Overview", href: "/income" },
          { name: "Accounts Receivable", href: "/accounts-receivable" },
          { name: "Invoices", href: "/invoices" }
        ]
      },
      { 
        name: "Expenditure", 
        icon: Receipt,
        subItems: [
          { name: "Overview", href: "/expenditure" },
          { name: "Accounts Payable", href: "/accounts-payable" },
          { name: "Vendors", href: "/vendors" }
        ]
      },
      { name: "Chart of Accounts", href: "/chart-of-accounts", icon: BookOpen },
      { name: "Trial Balance", href: "/trial-balance", icon: Scale },
      { name: "Collections", href: "/rental-payments", icon: CreditCard },
    ]
  },
  {
    title: "Procurement & Logistics Department",
    items: [
      { name: "Product Catalog", href: "/products", icon: Package },
      { name: "Inventory", href: "/inventory", icon: Warehouse },
      { name: "Barcode Scanner", href: "/barcode-scanner", icon: ScanBarcode },
      { 
        name: "Fleet", 
        icon: Truck,
        subItems: [
          { name: "Fleet Management", href: "/fleet" },
          { name: "Inspections", href: "/inspections" },
          { name: "Driver Companion", href: "/companion" },
          { name: "Fuel", href: "/fuel" }
        ]
      },
      { 
        name: "Maintenance", 
        icon: Wrench,
        subItems: [
          { name: "Maintenance", href: "/maintenance" },
          { name: "Schedule", href: "/schedule" }
        ]
      },
    ]
  },
  {
    title: "Divisional Sales & Contracts Department",
    items: [
      { name: "Dashboard", href: "/", icon: BarChart3 },
      { name: "Sales", href: "/sales", icon: ShoppingCart },
      { name: "Promotions", href: "/promotions", icon: Tag },
      { name: "Contracts", href: "/rental-agreements", icon: FileText },
      { name: "Customer Database", href: "/customers", icon: Users },
    ]
  }
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === "collapsed";
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "Main": true,
    "Finance Department": true,
    "Procurement & Logistics Department": true,
    "Divisional Sales & Contracts Department": true,
    "Group Supporting Departments": true
  });
  const { isAdmin, user, signOut } = useAuth();
  const [allowedSections, setAllowedSections] = useState<string[]>([]);

  // Load user's navigation permissions
  useEffect(() => {
    const loadPermissions = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('department_visibility')
        .select('department')
        .eq('user_id', user.id);
      
      if (data) {
        setAllowedSections(data.map(d => d.department));
      }
    };
    loadPermissions();
  }, [user]);

  // Check if user has access to a section
  const hasAccess = (sectionName: string, itemName?: string) => {
    if (isAdmin) return true;
    if (allowedSections.length === 0) return true; // No restrictions set
    
    // Check for specific item access
    if (itemName) {
      if (allowedSections.includes(itemName)) return true;
      if (allowedSections.includes(`${sectionName}-${itemName}`)) return true;
    }
    
    // Check for section access
    if (allowedSections.includes(sectionName)) return true;
    
    return false;
  };

  // Filter navigation based on permissions
  const filteredNavigation = navigation
    .map(section => {
      // Filter items within each section
      const filteredItems = section.items.filter(item => 
        hasAccess(section.title, item.name)
      );
      
      return {
        ...section,
        items: filteredItems
      };
    })
    .filter(section => section.items.length > 0); // Only show sections with visible items

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const isGroupActive = (item: any) => {
    if (item.href) return isActive(item.href);
    if (item.subItems) {
      return item.subItems.some((subItem: any) => isActive(subItem.href));
    }
    return false;
  };

  const toggleDropdown = (itemName: string) => {
    setOpenDropdowns(prev => {
      const isCurrentlyOpen = prev[itemName];
      // Close all dropdowns, then open only the clicked one if it was closed
      return isCurrentlyOpen ? {} : { [itemName]: true };
    });
  };

  const toggleSection = (sectionName: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  return (
    <Sidebar 
      className={`${isCollapsed ? "w-16" : "w-64"}`} 
      collapsible="icon"
      side="left"
    >
      <SidebarContent className="bg-sidebar-background">
        {/* Company Logo/Header */}
        <div className="p-3 md:p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex h-6 w-6 md:h-8 md:w-8 items-center justify-center rounded-lg overflow-hidden">
              <img src={magicCareLogo} alt="Magic Care Solutions Logo" className="h-full w-full object-contain" />
            </div>
            {!isCollapsed && (
              <div>
                <h2 className="text-sm md:text-lg font-semibold text-sidebar-foreground">Magic-Care</h2>
                <p className="text-xs text-sidebar-foreground/60">Solutions Limited</p>
              </div>
            )}
          </div>
        </div>

        {filteredNavigation.map((section) => (
          <Collapsible
            key={section.title}
            open={openSections[section.title]}
            onOpenChange={() => toggleSection(section.title)}
          >
            <SidebarGroup>
              {!isCollapsed && (
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs cursor-pointer hover:text-sidebar-foreground flex items-center justify-between w-full group">
                    {section.title}
                    <ChevronDown className={`h-3 w-3 transition-transform ${
                      openSections[section.title] ? 'rotate-180' : ''
                    }`} />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
              )}
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    {item.subItems ? (
                      <Collapsible 
                        open={openDropdowns[item.name] || isGroupActive(item)} 
                        onOpenChange={() => toggleDropdown(item.name)}
                      >
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton 
                            className={`group w-full ${
                              isGroupActive(item) 
                                ? "bg-primary text-primary-foreground" 
                                : "text-sidebar-foreground hover:bg-sidebar-accent"
                            }`}
                          >
                            <item.icon className="h-4 w-4 md:h-5 md:w-5" />
                            {!isCollapsed && <span className="font-medium text-sm">{item.name}</span>}
                            {!isCollapsed && (
                              <ChevronDown className={`ml-auto h-3 w-3 md:h-4 md:w-4 transition-transform ${
                                openDropdowns[item.name] || isGroupActive(item) ? 'rotate-180' : ''
                              }`} />
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        
                        {!isCollapsed && (
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.subItems.map((subItem) => (
                                <SidebarMenuSubItem key={subItem.name}>
                                  <SidebarMenuSubButton asChild>
                                    <NavLink
                                      to={subItem.href}
                                      className={({ isActive: navIsActive }) =>
                                        `flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-colors text-sm ${
                                          isActive(subItem.href)
                                            ? "bg-primary text-primary-foreground"
                                            : "text-sidebar-foreground hover:bg-sidebar-accent"
                                        }`
                                      }
                                    >
                                       {subItem.name === "Collections" ? (
                                        <CreditCard className="h-3 w-3 md:h-4 md:w-4" />
                                      ) : subItem.name === "Overview" ? (
                                        <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
                                      ) : subItem.name === "Income" ? (
                                        <DollarSign className="h-3 w-3 md:h-4 md:w-4" />
                                       ) : subItem.name === "Expenditure" ? (
                                        <FileText className="h-3 w-3 md:h-4 md:w-4" />
                                      ) : subItem.name === "Invoices" ? (
                                        <Receipt className="h-3 w-3 md:h-4 md:w-4" />
                                      ) : subItem.name === "Sales" ? (
                                        <ShoppingCart className="h-3 w-3 md:h-4 md:w-4" />
                                      ) : (
                                        <FileText className="h-3 w-3 md:h-4 md:w-4" />
                                      )}
                                      <span className="font-medium">{subItem.name}</span>
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        )}
                      </Collapsible>
                    ) : (
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.href}
                          className={({ isActive: navIsActive }) =>
                            `flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-colors text-sm ${
                              isActive(item.href)
                                ? "bg-primary text-primary-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent"
                            }`
                          }
                        >
                          <item.icon className="h-4 w-4 md:h-5 md:w-5" />
                          {!isCollapsed && <span className="font-medium">{item.name}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2 md:p-4">
        {isAdmin && (
          <Button 
            variant="ghost" 
            className="w-full justify-start mb-2" 
            asChild
          >
            <NavLink
              to="/admin"
              className={({ isActive: navIsActive }) =>
                `${isActive("/admin") ? "bg-primary text-primary-foreground" : ""}`
              }
            >
              <Shield className="h-4 w-4 md:h-5 md:w-5" />
              {!isCollapsed && <span className="ml-2 md:ml-3">Admin</span>}
            </NavLink>
          </Button>
        )}
        <Button 
          variant="ghost" 
          className="w-full justify-start" 
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 md:h-5 md:w-5" />
          {!isCollapsed && <span className="ml-2 md:ml-3">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}