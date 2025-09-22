import { NavLink, useLocation } from "react-router-dom";
import { 
  BarChart3, 
  Users, 
  Package, 
  FileText, 
  Settings,
  Building2
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navigation = [
  {
    title: "Sales Dashboard",
    items: [
      { name: "Overview", href: "/", icon: BarChart3 },
      { name: "Sales Log", href: "/sales", icon: FileText },
      { name: "Customers", href: "/customers", icon: Users },
      { name: "Products", href: "/products", icon: Package },
      { name: "Rental Agreements", href: "/rental-agreements", icon: FileText },
    ]
  },
  {
    title: "Future Departments",
    items: [
      { name: "Finance", href: "/finance", icon: BarChart3, disabled: true },
      { name: "Inventory", href: "/inventory", icon: Package, disabled: true },
    ]
  }
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <Sidebar className={isCollapsed ? "w-16" : "w-64"} collapsible="icon">
      <SidebarContent className="bg-sidebar-background">
        {/* Company Logo/Header */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div>
                <h2 className="text-lg font-semibold text-sidebar-foreground">Magic-Care</h2>
                <p className="text-xs text-sidebar-foreground/60">Solutions Limited</p>
              </div>
            )}
          </div>
        </div>

        {navigation.map((section) => (
          <SidebarGroup key={section.title}>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-sidebar-foreground/60">
                {section.title}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild disabled={item.disabled}>
                      <NavLink
                        to={item.href}
                        className={({ isActive: navIsActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            isActive(item.href)
                              ? "bg-primary text-primary-foreground"
                              : item.disabled
                              ? "text-sidebar-foreground/40 cursor-not-allowed"
                              : "text-sidebar-foreground hover:bg-sidebar-accent"
                          }`
                        }
                      >
                        <item.icon className="h-5 w-5" />
                        {!isCollapsed && <span className="font-medium">{item.name}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}