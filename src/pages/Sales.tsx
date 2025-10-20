import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, DollarSign, Calendar, User, FileText, Users, Package, CalendarIcon, Filter, Trash2, Check, ChevronsUpDown, CheckCircle, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSales } from "@/hooks/useSales";
import { useProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { useCustomers } from "@/hooks/useCustomers";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export default function Sales() {
  const { toast } = useToast();
  const { userDepartment, user, isAdmin } = useAuth();
  const { sales, loading, refetch } = useSales();
  const { products: supabaseProducts, updateProduct } = useProducts();
  const { customers } = useCustomers();
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [showFilters, setShowFilters] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearPassword, setClearPassword] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchValue, setCustomerSearchValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInProgress, setShowInProgress] = useState(true);
  const [catalogTimePeriod, setCatalogTimePeriod] = useState<'month' | 'quarter' | 'biannual' | 'annual'>('month');

  // Use products from Supabase instead of localStorage
  const products = supabaseProducts;

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

    if (isSubmitting) return;

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to log sales.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

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
      setIsSubmitting(false);
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
          status: 'in_progress'
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

      // Stock will be updated when sale is marked as completed
      
      toast({
        title: "Sale Created!",
        description: `Sale created with amount: $${total.toFixed(2)}. Mark as completed to update stock.`
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
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter sales based on search and date period - only show completed sales
  const filteredSales = sales.filter(sale => {
    const matchesSearch = searchTerm === "" || 
      sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.items.some(item => item.product_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const saleDate = new Date(sale.date);
    const matchesDateFrom = !dateFrom || saleDate >= dateFrom;
    const matchesDateTo = !dateTo || saleDate <= dateTo;
    
    return sale.status === 'completed' && matchesSearch && matchesDateFrom && matchesDateTo;
  });

  // Get in-progress sales
  const inProgressSales = sales.filter(sale => sale.status === 'in_progress');

  // Handler to mark sale as completed
  const handleMarkComplete = async (saleId: string) => {
    try {
      const sale = sales.find(s => s.id === saleId);
      if (!sale) return;

      // Update sale status to completed
      const { error: updateError } = await supabase
        .from('sales')
        .update({ status: 'completed' })
        .eq('id', saleId);

      if (updateError) throw updateError;

      // Update product stock for all items
      for (const item of sale.items) {
        const product = products.find(p => p.name === item.product_name);
        if (product) {
          await updateProduct(product.id, {
            stock: product.stock - item.quantity,
            last_sold: sale.date
          });
        }
      }

      toast({
        title: "Sale Completed!",
        description: "Sale marked as completed and stock updated."
      });

      refetch();
    } catch (error: any) {
      console.error('Error completing sale:', error);
      toast({
        title: "Error",
        description: error?.message ? `Failed to complete sale: ${error.message}` : "Failed to complete sale. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handler to mark sale as incomplete
  const handleMarkIncomplete = async (saleId: string) => {
    try {
      const sale = sales.find(s => s.id === saleId);
      if (!sale) return;

      // Update sale status to in_progress
      const { error: updateError } = await supabase
        .from('sales')
        .update({ status: 'in_progress' })
        .eq('id', saleId);

      if (updateError) throw updateError;

      // Restore product stock for all items
      for (const item of sale.items) {
        const product = products.find(p => p.name === item.product_name);
        if (product) {
          await updateProduct(product.id, {
            stock: product.stock + item.quantity
          });
        }
      }

      toast({
        title: "Sale Marked Incomplete",
        description: "Sale status reverted and stock restored."
      });

      refetch();
    } catch (error: any) {
      console.error('Error marking sale incomplete:', error);
      toast({
        title: "Error",
        description: error?.message ? `Failed to mark sale incomplete: ${error.message}` : "Failed to mark sale incomplete. Please try again.",
        variant: "destructive"
      });
    }
  };

  const setQuickDateRange = (days: number) => {
    const today = new Date();
    const fromDate = new Date();
    fromDate.setDate(today.getDate() - days);
    setDateFrom(fromDate);
    setDateTo(today);
  };

  const handleClearAllSales = async () => {
    if (!clearPassword || !user?.email) {
      toast({
        title: "Password Required",
        description: "Please enter your password to confirm.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Verify password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: clearPassword
      });

      if (signInError) {
        toast({
          title: "Authentication Failed",
          description: "Incorrect password. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Delete all sales and their items
      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) throw deleteError;

      toast({
        title: "Sales Cleared",
        description: "All sales have been successfully deleted."
      });

      setShowClearDialog(false);
      setClearPassword("");
      refetch();
    } catch (error) {
      console.error('Error clearing sales:', error);
      toast({
        title: "Error",
        description: "Failed to clear sales. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Filter products to exclude rental-only products for sales
  const availableProducts = products.filter(p => p.is_rental_only !== true);

  // Calculate product catalog sales for current user
  const getTimePeriodStart = () => {
    const now = new Date();
    const start = new Date();
    
    switch (catalogTimePeriod) {
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'biannual':
        start.setMonth(now.getMonth() - 6);
        break;
      case 'annual':
        start.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return start;
  };

  const productCatalogSales = products.map(product => {
    const timePeriodStart = getTimePeriodStart();
    
    // Get sales for this product by the current user within the time period
    const productSales = sales.filter(sale => 
      sale.user_id === user?.id &&
      sale.status === 'completed' &&
      new Date(sale.date) >= timePeriodStart &&
      sale.items.some(item => item.product_name === product.name)
    );

    const totalQuantity = productSales.reduce((sum, sale) => {
      const items = sale.items.filter(item => item.product_name === product.name);
      return sum + items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    const totalRevenue = productSales.reduce((sum, sale) => {
      const items = sale.items.filter(item => item.product_name === product.name);
      return sum + items.reduce((itemSum, item) => itemSum + (item.quantity * item.price), 0);
    }, 0);

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      totalQuantity,
      totalRevenue
    };
  }).filter(item => item.totalQuantity > 0); // Only show products with sales

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales Management</h1>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button 
              variant="destructive" 
              onClick={() => setShowClearDialog(true)}
              disabled={sales.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Sales
            </Button>
          )}
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
                  <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerSearchOpen}
                        className="w-full justify-between"
                        disabled={customers.length === 0}
                      >
                        {selectedCustomer
                          ? customers.find((customer) => customer.id === selectedCustomer)?.name
                          : customers.length === 0 ? "Add customers first" : "Search customer..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 bg-popover z-50" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Search customer..." 
                          value={customerSearchValue}
                          onValueChange={setCustomerSearchValue}
                        />
                        <CommandList>
                          <CommandEmpty>No customer found.</CommandEmpty>
                          <CommandGroup>
                            {customers
                              .filter(customer => 
                                customer.name.toLowerCase().includes(customerSearchValue.toLowerCase()) ||
                                customer.company?.toLowerCase().includes(customerSearchValue.toLowerCase()) ||
                                customer.email?.toLowerCase().includes(customerSearchValue.toLowerCase())
                              )
                              .map((customer) => (
                                <CommandItem
                                  key={customer.id}
                                  value={customer.name}
                                  onSelect={() => {
                                    setSelectedCustomer(customer.id);
                                    setCustomerSearchOpen(false);
                                    setCustomerSearchValue("");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedCustomer === customer.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{customer.name}</span>
                                    <span className="text-sm text-muted-foreground">{customer.company}</span>
                                  </div>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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

              <Button type="submit" className="w-full" disabled={availableProducts.length === 0 || isSubmitting}>
                {isSubmitting ? "Logging Sale..." : "Log Sale"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* In Progress Sales */}
      {inProgressSales.length > 0 && (
        <Card className="dashboard-card border-warning">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-card-foreground flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  In Progress Sales
                </CardTitle>
                <CardDescription>
                  Sales awaiting completion - mark as completed to update stock
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowInProgress(!showInProgress)}
              >
                {showInProgress ? "Hide" : "Show"} ({inProgressSales.length})
              </Button>
            </div>
          </CardHeader>
          {showInProgress && (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Sales Rep</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inProgressSales.map(sale => (
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
                      <TableCell className="text-right font-medium">
                        ${sale.total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleMarkComplete(sale.id)}
                          className="gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Mark Complete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
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
                  <TableHead className="text-right">Action</TableHead>
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
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkIncomplete(sale.id)}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Mark Incomplete
                      </Button>
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

      {/* Product Catalog Sales */}
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">My Product Sales</CardTitle>
              <CardDescription>
                Your total sales by product for the selected time period
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={catalogTimePeriod === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCatalogTimePeriod('month')}
              >
                Month
              </Button>
              <Button
                variant={catalogTimePeriod === 'quarter' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCatalogTimePeriod('quarter')}
              >
                Quarter
              </Button>
              <Button
                variant={catalogTimePeriod === 'biannual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCatalogTimePeriod('biannual')}
              >
                6 Months
              </Button>
              <Button
                variant={catalogTimePeriod === 'annual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCatalogTimePeriod('annual')}
              >
                Year
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {productCatalogSales.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Units Sold</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productCatalogSales
                  .sort((a, b) => b.totalRevenue - a.totalRevenue)
                  .map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.sku}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.category || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.totalQuantity}</TableCell>
                      <TableCell className="text-right font-medium text-success">
                        ${item.totalRevenue.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No sales in this period
              </h3>
              <p className="text-muted-foreground">
                You haven't made any completed sales in the selected time period.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Sales</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all sales records from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="clear-password">Enter your password to confirm</Label>
            <Input
              id="clear-password"
              type="password"
              placeholder="Your password"
              value={clearPassword}
              onChange={(e) => setClearPassword(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClearPassword("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllSales} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear All Sales
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}