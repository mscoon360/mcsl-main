import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
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

const navigation = [
  {
    title: "Main",
    items: [
      { name: "Dashboard", href: "/", icon: BarChart3 },
      { 
        name: "Sales", 
        icon: ShoppingCart,
        subItems: [
          { name: "Sales", href: "/sales" },
          { name: "Invoices", href: "/invoices" }
        ]
      },
      { name: "Customers", href: "/customers", icon: Users },
      { name: "Products", href: "/products", icon: Package },
      { 
        name: "Contracts", 
        icon: FileText,
        subItems: [
          { name: "All Contracts", href: "/rental-agreements" },
          { name: "Collections", href: "/rental-payments" }
        ]
      },
      { name: "Fulfillment", href: "/fulfillment", icon: Truck },
    ]
  },
  {
    title: "Finance",
    items: [
      { name: "Overview", href: "/finance", icon: BarChart3 },
      { name: "Income", href: "/income", icon: DollarSign },
      { name: "Expenditure", href: "/expenditure", icon: Receipt },
    ]
  }
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === "collapsed";
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const { isAdmin, signOut } = useAuth();

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
    setOpenDropdowns(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
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

        {navigation.map((section) => (
          <SidebarGroup key={section.title}>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs">
                {section.title}
              </SidebarGroupLabel>
            )}
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
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/admin"
                        className={({ isActive: navIsActive }) =>
                          `flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-colors text-sm ${
                            isActive("/admin")
                              ? "bg-primary text-primary-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent"
                          }`
                        }
                      >
                        <Shield className="h-4 w-4 md:h-5 md:w-5" />
                        {!isCollapsed && <span className="font-medium">Admin</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2 md:p-4">
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