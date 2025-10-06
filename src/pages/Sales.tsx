import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, DollarSign, Calendar, User, FileText, Users, Package, CalendarIcon, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSales } from "@/hooks/useSales";
import { supabase } from "@/integrations/supabase/client";

export default function Sales() {
  const { toast } = useToast();
  const { userDepartment, user } = useAuth();
  const { sales, loading, refetch } = useSales();
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [showFilters, setShowFilters] = useState(false);

  // Get customers and products from localStorage
  const [customers] = useLocalStorage<Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    company: string;
    address: string;
    city: string;
    totalSales: number;
    lastPurchase: string;
    status: string;
  }>>('dashboard-customers', []);

  const [products, setProducts] = useLocalStorage<Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    sku: string;
    category: string;
    stock: number;
    status: string;
    lastSold: string;
    isRental?: boolean;
    isRentalOnly?: boolean;
  }>>('dashboard-products', []);

  // Remove the localStorage sales state as we now use Supabase
  // const [sales, setSales] = useLocalStorage(...)

  const [salesItems, setSalesItems] = useState([{
    product: "",
    quantity: 1,
    price: 0,
    total: 0
  }]);

  const addSalesItem = () => {
    setSalesItems([...salesItems, {
      product: "",
      quantity: 1,
      price: 0,
      total: 0
    }]);
  };

  const updateSalesItem = (index: number, field: string, value: any) => {
    setSalesItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      if (field === 'quantity' || field === 'price') {
        updated[index].total = updated[index].quantity * updated[index].price;
      }
      return updated;
    });
  };

  const removeSalesItem = (index: number) => {
    setSalesItems(salesItems.filter((_, i) => i !== index));
  };

  const calculateGrandTotal = () => {
    return salesItems.reduce((sum, item) => sum + item.total, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to log sales.",
        variant: "destructive"
      });
      return;
    }

    // Check stock availability for all items, aggregated per product
    const qtyByProduct = salesItems.reduce((acc, item) => {
      const id = item.product;
      acc[id] = (acc[id] || 0) + item.quantity;
      return acc;
    }, {} as Record<string, number>);

    const stockErrors = Object.entries(qtyByProduct).filter(([productId, qty]) => {
      const product = products.find(p => p.id === productId);
      return product ? product.stock < qty : false;
    });

    if (stockErrors.length > 0) {
      toast({
        title: "Insufficient Stock",
        description: "Some products don't have enough stock available.",
        variant: "destructive"
      });
      return;
    }

    try {
      const customerName = customers.find(c => c.id === selectedCustomer)?.name || "Unknown Customer";
      const total = calculateGrandTotal();

      // Insert the sale
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          user_id: user.id,
          customer_name: customerName,
          total: total,
          date: saleDate,
          status: 'completed'
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Insert sale items
      const saleItemsData = salesItems.map(item => ({
        sale_id: saleData.id,
        product_name: products.find(p => p.id === item.product)?.name || "Unknown Product",
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItemsData);

      if (itemsError) throw itemsError;

      // Update product stock for all items (localStorage)
      const updatedProducts = products.map(product => {
        const totalQtySold = salesItems.filter(item => item.product === product.id).reduce((sum, i) => sum + i.quantity, 0);
        if (totalQtySold > 0) {
          return {
            ...product,
            stock: product.stock - totalQtySold,
            lastSold: saleDate
          };
        }
        return product;
      });

      setProducts(updatedProducts);
      
      toast({
        title: "Sale Logged Successfully!",
        description: `Total sale amount: $${total.toFixed(2)}. Stock updated.`
      });
      
      // Reset form
      setShowForm(false);
      setSelectedCustomer("");
      setSaleDate(new Date().toISOString().split('T')[0]);
      setSalesItems([{
        product: "",
        quantity: 1,
        price: 0,
        total: 0
      }]);

      // Refetch sales
      refetch();
    } catch (error) {
      console.error('Error logging sale:', error);
      toast({
        title: "Error",
        description: "Failed to log sale. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Filter sales based on search and date period
  const filteredSales = sales.filter(sale => {
    const matchesSearch = searchTerm === "" || 
      sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.items.some(item => item.product_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const saleDate = new Date(sale.date);
    const matchesDateFrom = !dateFrom || saleDate >= dateFrom;
    const matchesDateTo = !dateTo || saleDate <= dateTo;
    
    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const setQuickDateRange = (days: number) => {
    const today = new Date();
    const fromDate = new Date();
    fromDate.setDate(today.getDate() - days);
    setDateFrom(fromDate);
    setDateTo(today);
  };

  // Filter products to exclude rental-only products for sales
  const availableProducts = products.filter(p => p.isRentalOnly !== true);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales Management</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Cancel" : "Log New Sale"}
          </Button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      {showFilters && (
        <Card className="dashboard-card">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Search Sales</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer or product..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label>To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label>Quick Ranges</Label>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" onClick={() => setQuickDateRange(7)}>
                    Last 7 days
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setQuickDateRange(30)}>
                    Last 30 days
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Sale Form */}
      {showForm && (
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Log New Sale</CardTitle>
            <CardDescription>
              Enter the details of your completed sale below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer</Label>
                  <Select 
                    value={selectedCustomer} 
                    onValueChange={setSelectedCustomer} 
                    required 
                    disabled={customers.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={customers.length === 0 ? "Add customers first" : "Select customer"} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} - {customer.company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {customers.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      <Link to="/customers" className="text-primary hover:underline">
                        Add customers first
                      </Link> to start logging sales.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Sale Date</Label>
                  <Input 
                    type="date" 
                    value={saleDate} 
                    onChange={e => setSaleDate(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              {/* Sales Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">Sale Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addSalesItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {salesItems.map((item, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid grid-cols-5 gap-4 items-end">
                        <div className="space-y-2">
                          <Label>Product</Label>
                          <Select 
                            key={`prod-${index}-${item.product}`} 
                            value={item.product} 
                            onValueChange={value => {
                              const product = availableProducts.find(p => p.id === value);
                              updateSalesItem(index, 'product', value);
                              if (product) {
                                updateSalesItem(index, 'price', product.price);
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableProducts.length === 0 ? (
                                <div className="p-2 text-center">
                                  <p className="text-sm text-muted-foreground">No products available for sale</p>
                                  <Link to="/products" className="text-sm text-primary hover:underline">
                                    Add products first
                                  </Link>
                                </div>
                              ) : (
                                availableProducts.map(product => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input 
                            type="number" 
                            min="1" 
                            value={item.quantity} 
                            onChange={e => updateSalesItem(index, 'quantity', parseInt(e.target.value) || 1)} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unit Price</Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            value={item.price} 
                            readOnly={item.product !== ""} 
                            className={item.product !== "" ? "bg-muted" : ""} 
                            onChange={e => updateSalesItem(index, 'price', parseFloat(e.target.value) || 0)} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Total</Label>
                          <div className="font-bold text-lg text-success">
                            ${item.total.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          {salesItems.length > 1 && (
                            <Button 
                              type="button" 
                              variant="destructive" 
                              size="sm" 
                              onClick={() => removeSalesItem(index)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end">
                  <div className="text-right">
                    <p className="text-lg">Grand Total:</p>
                    <p className="text-3xl font-bold text-success">
                      ${calculateGrandTotal().toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full">
                Log Sale
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Sales Log */}
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Sales Log</CardTitle>
              <CardDescription>
                Recent sales transactions and order history
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSales.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Sales Rep</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map(sale => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.customer_name}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {sale.items.map((item, idx) => (
                          <div key={idx} className="text-sm">
                            {item.quantity}x {item.product_name}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{sale.rep_name}</TableCell>
                    <TableCell>{new Date(sale.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{sale.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${sale.total.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {sales.length === 0 ? "No sales logged yet" : "No sales match your filters"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {sales.length === 0 
                  ? "Start by adding customers and products, then log your first sale to see your transaction history here."
                  : "Try adjusting your search terms or date range to find more sales."
                }
              </p>
              <div className="flex gap-3 justify-center">
                <Button asChild variant="outline">
                  <Link to="/customers">
                    <Users className="h-4 w-4 mr-2" />
                    Add Customers
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/products">
                    <Package className="h-4 w-4 mr-2" />
                    Add Products
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}