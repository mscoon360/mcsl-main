import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  AlertTriangle, 
  Calendar as CalendarIcon, 
  StickyNote, 
  Truck, 
  Clock, 
  CheckCircle2,
  Package,
  Users,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";
import { useSales } from "@/hooks/useSales";
import { useProducts } from "@/hooks/useProducts";
import { useCustomers } from "@/hooks/useCustomers";
import { useExpiringContracts } from "@/hooks/useExpiringContracts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, isToday, isThisWeek, startOfDay, endOfDay, isBefore } from "date-fns";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface PurchaseOrder {
  id: string;
  status: string;
  inventory_status: string | null;
  order_number: string;
  vendor_name: string;
  created_at: string;
}

interface FulfillmentItem {
  id: string;
  customer: string;
  product: string;
  scheduled_date: string | null;
  status: string | null;
}

export default function Home() {
  const { sales } = useSales();
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { expiringContracts, count: expiringCount } = useExpiringContracts();
  const { user } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useLocalStorage<string>("company-notes", "");
  const [pendingApprovals, setPendingApprovals] = useState<PurchaseOrder[]>([]);
  const [fulfillmentItems, setFulfillmentItems] = useState<FulfillmentItem[]>([]);
  const [invoicesPending, setInvoicesPending] = useState(0);
  const [overduePayables, setOverduePayables] = useState(0);

  // Fetch pending approvals and fulfillment items
  useEffect(() => {
    const fetchData = async () => {
      // Pending purchase orders
      const { data: poData } = await supabase
        .from('purchase_orders')
        .select('id, status, inventory_status, order_number, vendor_name, created_at')
        .eq('status', 'pending');
      
      if (poData) setPendingApprovals(poData);

      // Fulfillment items
      const { data: fulfillData } = await supabase
        .from('fulfillment_items')
        .select('id, customer, product, scheduled_date, status')
        .in('status', ['pending', 'in_progress']);
      
      if (fulfillData) setFulfillmentItems(fulfillData);

      // Pending invoices count
      const { count: invoiceCount } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'draft');
      
      setInvoicesPending(invoiceCount || 0);

      // Overdue payables count
      const { count: payablesCount } = await supabase
        .from('accounts_payable')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'unpaid')
        .lt('due_date', format(new Date(), 'yyyy-MM-dd'));
      
      setOverduePayables(payablesCount || 0);
    };

    fetchData();
  }, []);

  // Calculate metrics
  const completedSales = sales.filter(s => s.status === 'completed');
  const salesToday = completedSales.filter(s => isToday(new Date(s.date))).length;
  const salesThisWeek = completedSales.filter(s => isThisWeek(new Date(s.date))).length;
  
  const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.min_stock || 0) && (p.stock || 0) > 0);
  const outOfStockProducts = products.filter(p => p.stock === 0);
  
  const jobsToday = fulfillmentItems.filter(f => 
    f.scheduled_date && isToday(new Date(f.scheduled_date))
  );
  
  const jobsOverdue = fulfillmentItems.filter(f => 
    f.scheduled_date && isBefore(new Date(f.scheduled_date), startOfDay(new Date())) && f.status !== 'completed'
  );

  const delayedDeliveries = fulfillmentItems.filter(f => 
    f.status === 'pending' && f.scheduled_date && isBefore(new Date(f.scheduled_date), new Date())
  );

  // Department statuses
  const departmentStatuses = [
    {
      name: "Sales",
      status: salesToday > 0 ? "on-track" : "attention",
      label: salesToday > 0 ? "On Track" : "No Sales Today",
      color: salesToday > 0 ? "bg-green-500" : "bg-yellow-500"
    },
    {
      name: "Accounting",
      status: invoicesPending === 0 ? "on-track" : "attention",
      label: invoicesPending === 0 ? "Invoicing Up to Date" : `${invoicesPending} Pending`,
      color: invoicesPending === 0 ? "bg-green-500" : "bg-yellow-500"
    },
    {
      name: "Procurement",
      status: pendingApprovals.length > 0 ? "waiting" : "on-track",
      label: pendingApprovals.length > 0 ? "Waiting on Suppliers" : "All Clear",
      color: pendingApprovals.length > 0 ? "bg-yellow-500" : "bg-green-500"
    },
    {
      name: "Logistics",
      status: jobsOverdue.length === 0 ? "on-track" : "attention",
      label: jobsOverdue.length === 0 ? "On Schedule" : `${jobsOverdue.length} Overdue`,
      color: jobsOverdue.length === 0 ? "bg-green-500" : "bg-yellow-500"
    },
    {
      name: "Stock",
      status: outOfStockProducts.length === 0 && lowStockProducts.length === 0 ? "on-track" : "reorder",
      label: outOfStockProducts.length > 0 ? "Reorder Required" : lowStockProducts.length > 0 ? "Low Stock" : "Sufficient",
      color: outOfStockProducts.length > 0 ? "bg-red-500" : lowStockProducts.length > 0 ? "bg-yellow-500" : "bg-green-500"
    }
  ];

  // Company calendar events (mock data - would be from database)
  const calendarEvents = [
    ...jobsToday.map(j => ({ type: "delivery", title: `Delivery: ${j.product} to ${j.customer}` })),
    ...(expiringCount > 0 ? [{ type: "followup", title: `${expiringCount} contracts expiring soon` }] : [])
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Company Dashboard</h1>
        <p className="text-muted-foreground">Overview for {format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      {/* Department Status Strip */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Department Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {departmentStatuses.map((dept) => (
              <div key={dept.name} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50">
                <div className={`w-3 h-3 rounded-full ${dept.color}`} />
                <span className="font-medium">{dept.name}:</span>
                <span className="text-muted-foreground">{dept.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Daily Notifications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Daily Notifications
            </CardTitle>
            <Badge variant="secondary">{expiringCount + lowStockProducts.length + outOfStockProducts.length}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {expiringCount > 0 && (
                  <div className="flex items-start gap-2 p-2 rounded bg-yellow-500/10">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{expiringCount} contracts expiring</p>
                      <p className="text-xs text-muted-foreground">Review in Contracts</p>
                    </div>
                  </div>
                )}
                {outOfStockProducts.length > 0 && (
                  <div className="flex items-start gap-2 p-2 rounded bg-red-500/10">
                    <Package className="h-4 w-4 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{outOfStockProducts.length} products out of stock</p>
                      <p className="text-xs text-muted-foreground">Reorder required</p>
                    </div>
                  </div>
                )}
                {lowStockProducts.length > 0 && (
                  <div className="flex items-start gap-2 p-2 rounded bg-yellow-500/10">
                    <Package className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{lowStockProducts.length} products low on stock</p>
                      <p className="text-xs text-muted-foreground">Consider reordering</p>
                    </div>
                  </div>
                )}
                {overduePayables > 0 && (
                  <div className="flex items-start gap-2 p-2 rounded bg-red-500/10">
                    <FileText className="h-4 w-4 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{overduePayables} overdue payables</p>
                      <p className="text-xs text-muted-foreground">Action required</p>
                    </div>
                  </div>
                )}
                {expiringCount === 0 && lowStockProducts.length === 0 && outOfStockProducts.length === 0 && overduePayables === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Urgent Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Urgent Requests
            </CardTitle>
            <Badge variant="destructive">{pendingApprovals.length + jobsOverdue.length}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {pendingApprovals.slice(0, 5).map((po) => (
                  <div key={po.id} className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <Clock className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">PO #{po.order_number}</p>
                      <p className="text-xs text-muted-foreground">{po.vendor_name} - Awaiting approval</p>
                    </div>
                  </div>
                ))}
                {jobsOverdue.slice(0, 5).map((job) => (
                  <div key={job.id} className="flex items-start gap-2 p-2 rounded bg-red-500/10">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{job.product}</p>
                      <p className="text-xs text-muted-foreground">{job.customer} - Overdue</p>
                    </div>
                  </div>
                ))}
                {pendingApprovals.length === 0 && jobsOverdue.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No urgent requests</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Jobs Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Jobs Scheduled Today
            </CardTitle>
            <Badge variant="outline">{jobsToday.length}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {jobsToday.map((job) => (
                  <div key={job.id} className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{job.product}</p>
                      <p className="text-xs text-muted-foreground">{job.customer}</p>
                    </div>
                  </div>
                ))}
                {jobsToday.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No jobs scheduled today</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Sales Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Sales Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Sales Today</span>
                <Badge variant="secondary" className="text-lg">{salesToday}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Sales This Week</span>
                <Badge variant="secondary" className="text-lg">{salesThisWeek}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Pending Approvals
            </CardTitle>
            <Badge variant="outline">{pendingApprovals.length}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {pendingApprovals.slice(0, 5).map((po) => (
                  <div key={po.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">PO #{po.order_number}</p>
                      <p className="text-xs text-muted-foreground">{po.vendor_name}</p>
                    </div>
                    <Badge variant="outline">Pending</Badge>
                  </div>
                ))}
                {pendingApprovals.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No pending approvals</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Stock Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-destructive" />
              Stock Alerts
            </CardTitle>
            <Badge variant="destructive">{outOfStockProducts.length + lowStockProducts.length}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {outOfStockProducts.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded bg-red-500/10">
                    <span className="text-sm truncate">{p.name}</span>
                    <Badge variant="destructive">Out of Stock</Badge>
                  </div>
                ))}
                {lowStockProducts.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded bg-yellow-500/10">
                    <span className="text-sm truncate">{p.name}</span>
                    <Badge variant="outline" className="text-yellow-600">Low: {p.stock}</Badge>
                  </div>
                ))}
                {outOfStockProducts.length === 0 && lowStockProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Stock levels sufficient</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Company Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
              />
              <div className="flex-1">
                <h4 className="font-medium mb-3">Events on {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Today"}</h4>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {calendarEvents.length > 0 ? (
                      calendarEvents.map((event, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-2 rounded bg-muted/50">
                          {event.type === "delivery" && <Truck className="h-4 w-4 text-blue-500 mt-0.5" />}
                          {event.type === "followup" && <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />}
                          <span className="text-sm">{event.title}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No events scheduled</p>
                    )}
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Legend:</p>
                      <div className="flex flex-wrap gap-4 text-xs">
                        <div className="flex items-center gap-1"><Truck className="h-3 w-3 text-blue-500" /> Deliveries</div>
                        <div className="flex items-center gap-1"><Users className="h-3 w-3 text-green-500" /> Installations</div>
                        <div className="flex items-center gap-1"><FileText className="h-3 w-3 text-purple-500" /> Training</div>
                        <div className="flex items-center gap-1"><CalendarIcon className="h-3 w-3 text-primary" /> Events</div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-yellow-500" />
              Company Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add notes here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[250px] resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">Notes are saved automatically</p>
          </CardContent>
        </Card>
      </div>

      {/* System Notices & Follow-ups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Follow-ups Due Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Follow-ups Due Today
            </CardTitle>
            <Badge variant="outline">{expiringCount}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {expiringContracts.slice(0, 5).map((contract) => (
                  <div key={contract.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{contract.customer}</p>
                      <p className="text-xs text-muted-foreground">{contract.product}</p>
                    </div>
                    <Badge variant="outline">{contract.daysUntilExpiry} days</Badge>
                  </div>
                ))}
                {expiringCount === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No follow-ups due</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* System Notices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              System Notices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {delayedDeliveries.length > 0 && (
                  <div className="flex items-start gap-2 p-2 rounded bg-yellow-500/10">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{delayedDeliveries.length} delayed deliveries</p>
                      <p className="text-xs text-muted-foreground">Requires attention</p>
                    </div>
                  </div>
                )}
                {invoicesPending > 0 && (
                  <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{invoicesPending} draft invoices</p>
                      <p className="text-xs text-muted-foreground">Ready for review</p>
                    </div>
                  </div>
                )}
                {delayedDeliveries.length === 0 && invoicesPending === 0 && (
                  <div className="flex items-center gap-2 p-2 rounded bg-green-500/10">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <p className="text-sm">All systems operational</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
