import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Truck, Package, Clock, CheckCircle, AlertCircle, User } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface FulfillmentItem {
  id: string;
  saleId: string;
  customer: string;
  product: string;
  quantity: number;
  saleDate: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  trackingNumber?: string;
  shippedDate?: string;
  estimatedDelivery?: string;
}

export default function Fulfillment() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Get sales data to create fulfillment items
  const [sales] = useLocalStorage<Array<{
    id: string;
    customer: string;
    total: number;
    items: Array<{
      product: string;
      quantity: number;
      price: number;
    }>;
    date: string;
    status: string;
  }>>('dashboard-sales', []);

  // Get/set fulfillment data
  const [fulfillmentItems, setFulfillmentItems] = useLocalStorage<FulfillmentItem[]>('dashboard-fulfillment', []);

  // Create fulfillment items from sales if not already created
  useState(() => {
    const existingFulfillmentIds = new Set(fulfillmentItems.map(item => item.saleId));
    const newFulfillmentItems: FulfillmentItem[] = [];

    sales.forEach(sale => {
      if (!existingFulfillmentIds.has(sale.id)) {
        sale.items.forEach((item, index) => {
          newFulfillmentItems.push({
            id: `${sale.id}-${index}`,
            saleId: sale.id,
            customer: sale.customer,
            product: item.product,
            quantity: item.quantity,
            saleDate: sale.date,
            status: 'pending'
          });
        });
      }
    });

    if (newFulfillmentItems.length > 0) {
      setFulfillmentItems(prev => [...prev, ...newFulfillmentItems]);
    }
  });

  // Filter fulfillment items
  const filteredItems = fulfillmentItems.filter(item => {
    const matchesSearch = searchTerm === "" || 
      item.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'shipped': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'delivered': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'processing': return <Package className="h-4 w-4" />;
      case 'shipped': return <Truck className="h-4 w-4" />;
      case 'delivered': return <CheckCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const updateStatus = (itemId: string, newStatus: FulfillmentItem['status']) => {
    setFulfillmentItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              status: newStatus,
              shippedDate: newStatus === 'shipped' ? new Date().toISOString().split('T')[0] : item.shippedDate,
              trackingNumber: newStatus === 'shipped' && !item.trackingNumber ? `TRK${Date.now()}` : item.trackingNumber
            }
          : item
      )
    );

    toast({
      title: "Status Updated",
      description: `Order status updated to ${newStatus}.`
    });
  };

  // Calculate statistics
  const totalItems = fulfillmentItems.length;
  const pendingItems = fulfillmentItems.filter(item => item.status === 'pending').length;
  const shippedItems = fulfillmentItems.filter(item => item.status === 'shipped').length;
  const deliveredItems = fulfillmentItems.filter(item => item.status === 'delivered').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fulfillment Center</h1>
          <p className="text-muted-foreground">Manage order fulfillment and shipping</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Total Orders
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{totalItems}</div>
            <p className="text-xs text-muted-foreground">
              All fulfillment items
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Pending
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{pendingItems}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting processing
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Shipped
            </CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{shippedItems}</div>
            <p className="text-xs text-muted-foreground">
              In transit
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Delivered
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{deliveredItems}</div>
            <p className="text-xs text-muted-foreground">
              Successfully delivered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="dashboard-card">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label>Search Orders</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer, product, or tracking number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="w-full md:w-48">
              <Label>Filter by Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fulfillment Items Table */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Fulfillment Orders</CardTitle>
          <CardDescription>
            Manage and track order fulfillment status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Orders Found</h3>
              <p className="text-muted-foreground mb-4">
                {fulfillmentItems.length === 0 
                  ? "Orders will appear here when sales are made." 
                  : "No orders match your search criteria."
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Sale Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {item.customer}
                        </div>
                      </TableCell>
                      <TableCell>{item.product}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{format(new Date(item.saleDate), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(item.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(item.status)}
                            {item.status}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.trackingNumber ? (
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {item.trackingNumber}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.status}
                          onValueChange={(value) => updateStatus(item.id, value as FulfillmentItem['status'])}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="shipped">Shipped</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}