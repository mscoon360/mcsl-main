import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, DollarSign, Calendar, User, FileText, Users, Package, CalendarIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
export default function Sales() {
  const {
    toast
  } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);

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
  const [products] = useLocalStorage<Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    sku: string;
    category: string;
    stock: number;
    status: string;
    lastSold: string;
  }>>('dashboard-products', []);
  const [sales, setSales] = useLocalStorage<Array<{
    id: string;
    customer: string;
    total: number;
    items: Array<{
      product: string;
      quantity: number;
      price: number;
      isRental?: boolean;
      contractLength?: string;
      paymentPeriod?: string;
      startDate?: Date;
      endDate?: Date;
    }>;
    date: string;
    status: string;
  }>>('dashboard-sales', []);
  const [salesItems, setSalesItems] = useState([{
    product: "",
    quantity: 1,
    price: 0,
    total: 0,
    isRental: false,
    contractLength: "",
    paymentPeriod: "monthly",
    startDate: undefined,
    endDate: undefined
  }]);
  const addSalesItem = () => {
    setSalesItems([...salesItems, {
      product: "",
      quantity: 1,
      price: 0,
      total: 0,
      isRental: false,
      contractLength: "",
      paymentPeriod: "monthly",
      startDate: undefined,
      endDate: undefined
    }]);
  };
  const updateSalesItem = (index: number, field: string, value: any) => {
    const updated = [...salesItems];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    if (field === 'quantity' || field === 'price') {
      updated[index].total = updated[index].quantity * updated[index].price;
    }

    // Calculate end date when start date or contract length changes
    if ((field === 'startDate' || field === 'contractLength') && updated[index].startDate && updated[index].contractLength) {
      const startDate = updated[index].startDate;
      const [number, unit] = updated[index].contractLength.split(' ');
      if (number && unit) {
        const endDate = new Date(startDate);
        if (unit === 'months') {
          endDate.setMonth(endDate.getMonth() + parseInt(number));
        } else if (unit === 'years') {
          endDate.setFullYear(endDate.getFullYear() + parseInt(number));
        }
        updated[index].endDate = endDate;
      }
    }
    setSalesItems(updated);
  };
  const removeSalesItem = (index: number) => {
    setSalesItems(salesItems.filter((_, i) => i !== index));
  };
  const calculateGrandTotal = () => {
    return salesItems.reduce((sum, item) => sum + item.total, 0);
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Create the new sale object
    const newSale = {
      id: Date.now().toString(),
      customer: customers.find(c => c.id === selectedCustomer)?.name || "Unknown Customer",
      total: calculateGrandTotal(),
      items: salesItems.map(item => ({
        product: products.find(p => p.id === item.product)?.name || "Unknown Product",
        quantity: item.quantity,
        price: item.price,
        isRental: item.isRental,
        contractLength: item.contractLength,
        paymentPeriod: item.paymentPeriod,
        startDate: item.startDate,
        endDate: item.endDate
      })),
      date: saleDate,
      status: "completed"
    };

    // Add to sales array
    setSales(prev => [...prev, newSale]);
    toast({
      title: "Sale Logged Successfully!",
      description: `Total sale amount: $${calculateGrandTotal().toFixed(2)}`
    });
    setShowForm(false);
    setSelectedCustomer("");
    setSaleDate(new Date().toISOString().split('T')[0]);
    setSalesItems([{
      product: "",
      quantity: 1,
      price: 0,
      total: 0,
      isRental: false,
      contractLength: "",
      paymentPeriod: "monthly",
      startDate: undefined,
      endDate: undefined
    }]);
  };
  return <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales Management</h1>
          
      </div>

      {/* Sales Statistics */}
      
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? "Cancel" : "Log New Sale"}
        </Button>
      </div>

      {/* New Sale Form */}
      {showForm && <Card className="dashboard-card">
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
                  <Select value={selectedCustomer} onValueChange={setSelectedCustomer} required disabled={customers.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder={customers.length === 0 ? "Add customers first" : "Select customer"} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} - {customer.company}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  {customers.length === 0 && <p className="text-sm text-muted-foreground">
                      <Link to="/customers" className="text-primary hover:underline">
                        Add customers first
                      </Link> to start logging sales.
                    </p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Sale Date</Label>
                  <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} required />
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
                  {salesItems.map((item, index) => <Card key={index} className="p-4">
                      <div className="space-y-4">
                        <div className="grid grid-cols-5 gap-4 items-end">
                          <div className="space-y-2">
                            <Label>Product</Label>
                            <Select key={`prod-${index}-${item.product}`} value={item.product} onValueChange={(value) => {
                        console.log('Product selected:', value);
                        const product = products.find(p => p.id === value);
                        updateSalesItem(index, 'product', value);
                        if (product) {
                          updateSalesItem(index, 'price', product.price);
                        }
                      }}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.length === 0 ? <div className="p-2 text-center">
                                    <p className="text-sm text-muted-foreground">No products available</p>
                                    <Link to="/products" className="text-sm text-primary hover:underline">
                                      Add products first
                                    </Link>
                                  </div> : products.map(product => <SelectItem key={product.id} value={product.id}>
                                      {product.name}
                                    </SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Quantity</Label>
                            <Input type="number" min="1" value={item.quantity} onChange={e => updateSalesItem(index, 'quantity', parseInt(e.target.value) || 1)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Unit Price</Label>
                            <Input type="number" step="0.01" value={item.price} readOnly={item.product !== ""} className={item.product !== "" ? "bg-muted" : ""} onChange={e => updateSalesItem(index, 'price', parseFloat(e.target.value) || 0)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Total</Label>
                            <div className="font-bold text-lg text-success">
                              ${item.total.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            {salesItems.length > 1 && <Button type="button" variant="destructive" size="sm" onClick={() => removeSalesItem(index)}>
                                Remove
                              </Button>}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input type="checkbox" id={`rental-${index}`} checked={item.isRental} onChange={e => updateSalesItem(index, 'isRental', e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                          <Label htmlFor={`rental-${index}`}>Rental Agreement</Label>
                        </div>
                        
                        {item.isRental && <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg">
                            <div className="space-y-2">
                              <Label>Contract Length</Label>
                              <div className="flex gap-2">
                                <Select value={item.contractLength.split(' ')[0] || ""} onValueChange={value => {
                          const unit = item.contractLength.split(' ')[1] || 'months';
                          updateSalesItem(index, 'contractLength', `${value} ${unit}`);
                        }}>
                                  <SelectTrigger className="w-20">
                                    <SelectValue placeholder="Qty" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36].map(num => <SelectItem key={num} value={num.toString()}>
                                        {num}
                                      </SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <Select value={item.contractLength.split(' ')[1] || "months"} onValueChange={value => {
                          const number = item.contractLength.split(' ')[0] || '1';
                          updateSalesItem(index, 'contractLength', `${number} ${value}`);
                        }}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="months">Months</SelectItem>
                                    <SelectItem value="years">Years</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Payment Period</Label>
                              <Select value={item.paymentPeriod} onValueChange={value => updateSalesItem(index, 'paymentPeriod', value)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="quarterly">Quarterly</SelectItem>
                                  <SelectItem value="biannually">Bi-annually</SelectItem>
                                  <SelectItem value="annually">Annually</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Contract Start Date</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !item.startDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {item.startDate ? format(item.startDate, "PPP") : <span>Pick a date</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <CalendarComponent mode="single" selected={item.startDate} onSelect={date => updateSalesItem(index, 'startDate', date)} initialFocus className={cn("p-3 pointer-events-auto")} />
                                </PopoverContent>
                              </Popover>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Contract End Date</Label>
                              <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                                {item.endDate ? format(item.endDate, "PPP") : "Auto-calculated"}
                              </div>
                            </div>
                          </div>}
                      </div>
                    </Card>)}
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

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea id="notes" placeholder="Add any additional notes about this sale..." className="min-h-[100px]" />
              </div>

              <Button type="submit" className="w-full" size="lg">
                <DollarSign className="h-4 w-4 mr-2" />
                Log Sale - ${calculateGrandTotal().toFixed(2)}
              </Button>
            </form>
          </CardContent>
        </Card>}

      {/* Sales History */}
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Sales History</CardTitle>
              <CardDescription>
                Recent sales transactions and their details.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search sales..." className="w-64" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sales.length > 0 ? <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map(sale => <TableRow key={sale.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {sale.customer}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {sale.items.map((item, idx) => <div key={idx} className="text-sm">
                            {item.quantity}x {item.product}
                          </div>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(sale.date).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={sale.status === 'completed' ? 'default' : 'secondary'}>
                        {sale.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-success">
                      ${sale.total.toFixed(2)}
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table> : <div className="text-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No sales logged yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Start by adding customers and products, then log your first sale to see your transaction history here.
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
            </div>}
        </CardContent>
      </Card>
    </div>;
}