import { Bell, Search, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExpiringContracts } from "@/hooks/useExpiringContracts";
import { format } from "date-fns";
import { Link } from "react-router-dom";
export function DashboardHeader() {
  const {
    user,
    signOut
  } = useAuth();
  const [userName, setUserName] = useState<string>("");
  const {
    expiringContracts,
    count
  } = useExpiringContracts();
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      const {
        data,
        error
      } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();
      if (!error && data) {
        setUserName(data.name);
      }
    };
    fetchUserProfile();
  }, [user]);
  return <header className="border-b border-border bg-header-bg px-3 md:px-6 py-3 md:py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4">
          <SidebarTrigger />
          <div className="relative max-w-md hidden sm:block">
            
            
          </div>
          <Button variant="ghost" size="icon" className="sm:hidden">
            <Search className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                {count > 0 && <span className="absolute -top-1 -right-1 h-3 w-3 md:h-4 md:w-4 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center font-medium">
                    {count}
                  </span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Expiring Contracts</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {count === 0 ? <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No contracts expiring in the next 30 days
                </div> : <>
                  <div className="max-h-80 overflow-y-auto">
                    {expiringContracts.map(contract => <DropdownMenuItem key={contract.id} className="flex flex-col items-start gap-1 p-3">
                        <div className="flex items-start gap-2 w-full">
                          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{contract.product}</p>
                            <p className="text-xs text-muted-foreground truncate">{contract.customer}</p>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-xs text-muted-foreground">
                                Expires: {format(contract.endDate, "MMM dd, yyyy")}
                              </p>
                              <span className="text-xs font-medium text-destructive">
                                {contract.daysUntilExpiry} {contract.daysUntilExpiry === 1 ? 'day' : 'days'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </DropdownMenuItem>)}
                  </div>
                  <DropdownMenuSeparator />
                  <Link to="/rental-agreements">
                    <DropdownMenuItem className="justify-center font-medium cursor-pointer">
                      View All Rental Agreements
                    </DropdownMenuItem>
                  </Link>
                </>}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{userName || user?.email || 'User Account'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => signOut()}>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>;
}