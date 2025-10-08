import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Calendar, DollarSign, User, Plus, CalendarIcon } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { format, differenceInMonths } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { useSales } from "@/hooks/useSales";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCustomers } from "@/hooks/useCustomers";

interface RentalAgreement {
  id: string;
  customer: string;
  product: string;
  contractLength: string;
  paymentPeriod: string;
  startDate: Date;
  endDate: Date;
  monthlyAmount: number;
  totalValue: number;
  status: 'active' | 'expired' | 'cancelled';
  saleId: string;
  saleDate: string;
}

export default function RentalAgreements() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { products: supabaseProducts, updateProduct } = useProducts();
  const { sales: supabaseSales, refetch } = useSales();
  const { customers } = useCustomers();
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [contractLength, setContractLength] = useState("");
  const [paymentPeriod, setPaymentPeriod] = useState("monthly");
  const [startDate, setStartDate] = useState<Date>();

  // Support multiple rental items
  const [rentalItems, setRentalItems] = useState([{
    product: "",
    quantity: 1,
    price: 0
  }]);

  const addRentalItem = () => {
    setRentalItems([...rentalItems, {
      product: "",
      quantity: 1,
      price: 0
    }]);
  };

  const updateRentalItem = (index: number, field: string, value: any) => {
    setRentalItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  const removeRentalItem = (index: number) => {
    if (rentalItems.length > 1) {
      setRentalItems(rentalItems.filter((_, i) => i !== index));
    }
  };

  // Use products from Supabase
  const products = supabaseProducts;

  // Get sales from Supabase instead of localStorage
  const sales = supabaseSales;

  // Extract rental agreements from sales data
  const rentalAgreements: RentalAgreement[] = sales.flatMap(sale => 
    sale.items
      .filter(item => item.is_rental && item.start_date && item.end_date)
      .map(item => {
        const startDate = new Date(item.start_date!);
        const endDate = new Date(item.end_date!);
        const monthsInContract = differenceInMonths(endDate, startDate);
        
        return {
          id: `${sale.id}-${item.product_name}`,
          customer: sale.customer_name,
          product: item.product_name,
          contractLength: item.contract_length || '',
          paymentPeriod: item.payment_period || 'monthly',
          startDate,
          endDate,
           monthlyAmount: item.price * item.quantity,
           totalValue: item.price * monthsInContract * item.quantity,
          status: endDate > new Date() ? 'active' : 'expired' as 'active' | 'expired',
          saleId: sale.id,
          saleDate: sale.date
        };
      })
  );

  // Filter products for rental (rental products or rental-only products)
  const rentalProducts = products.filter(p => p.is_rental || p.is_rental_only);

  // Filter agreements based on search term
  const filteredAgreements = rentalAgreements.filter(agreement =>
    agreement.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agreement.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agreement.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'expired': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Months in a payment period (per user definition)
  const monthsInPaymentPeriod = (period: string) => {
    switch (period?.toLowerCase()) {
      case 'monthly': return 1;
      case 'quarterly': return 3;
      case 'biannually':
      case 'bi-annually': return 6;
      case 'annually':
      case 'yearly': return 12;
      default: return 1;
    }
  };

  const periodShortLabel = (period: string) => {
    const p = period?.toLowerCase();
    if (p === 'monthly') return 'month';
    if (p === 'quarterly') return 'quarter';
    if (p === 'biannually' || p === 'bi-annually') return 'biannual';
    if (p === 'annually' || p === 'yearly') return 'year';
    return p || 'period';
  };

  const activeAgreements = rentalAgreements.filter(a => a.status === 'active').length;
  const totalMonthlyRevenue = rentalAgreements
    .filter(a => a.status === 'active')
    .reduce((sum, a) => sum + a.monthlyAmount, 0);
  const totalContractValue = rentalAgreements
    .filter(a => a.status === 'active')
    .reduce((sum, a) => sum + a.totalValue, 0);

  const calculateEndDate = (start: Date, contractLength: string) => {
    const [number, unit] = contractLength.split(' ');
    if (number && unit && start) {
      const endDate = new Date(start);
      if (unit === 'months') {
        endDate.setMonth(endDate.getMonth() + parseInt(number));
      } else if (unit === 'years') {
        endDate.setFullYear(endDate.getFullYear() + parseInt(number));
      }
      return endDate;
    }
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create rental agreements.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedCustomer || !startDate || !contractLength || rentalItems.some(item => !item.product)) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and add at least one rental item.",
        variant: "destructive"
      });
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomer);
    if (!customer) {
      toast({
        title: "Error",
        description: "Selected customer not found.",
        variant: "destructive"
      });
      return;
    }

    const endDate = calculateEndDate(startDate, contractLength);
    if (!endDate) {
      toast({
        title: "Error",
        description: "Could not calculate end date.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Create sale items from rental items
      const saleItems = rentalItems.map(item => {
        const product = products.find(p => p.id === item.product);
        if (!product) throw new Error(`Product ${item.product} not found`);
        
        return {
          product_name: product.name,
          quantity: item.quantity,
          price: product.price,
          is_rental: true,
          contract_length: contractLength,
          payment_period: paymentPeriod,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        };
      });

      const totalAmount = saleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Create the sale in Supabase
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{
          customer_name: customer.name,
          total: totalAmount,
          date: startDate.toISOString(),
          status: 'completed',
          user_id: user.id
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      // Create the sale items
      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems.map(item => ({
          ...item,
          sale_id: saleData.id
        })));

      if (itemsError) throw itemsError;

      // Update product stock for rental items
      for (const item of rentalItems) {
        const product = products.find(p => p.id === item.product);
        if (product) {
          await updateProduct(product.id, {
            stock: (product.stock || 0) - item.quantity
          });
        }
      }

      toast({
        title: "Rental Agreement Created!",
        description: `Rental agreement for ${customer.name} has been created successfully.`
      });

      // Reset form
      setShowForm(false);
      setSelectedCustomer("");
      setRentalItems([{
        product: "",
        quantity: 1,
        price: 0
      }]);
      setContractLength("");
      setPaymentPeriod("monthly");
      setStartDate(undefined);

      // Refetch sales to update the list
      refetch();
    } catch (error) {
      console.error('Error creating rental agreement:', error);
      toast({
        title: "Error",
        description: "Failed to create rental agreement. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rental Agreements</h1>
          <p className="text-muted-foreground">Manage and track all rental agreements</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? "Cancel" : "New Rental Agreement"}
        </Button>
      </div>

      {/* New Rental Agreement Form */}
      {showForm && (
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Create New Rental Agreement</CardTitle>
            <CardDescription>
              Set up a new rental agreement for a customer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer} required disabled={customers.length === 0}>
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
                    </Link> to create rental agreements.
                  </p>
                )}
              </div>

              {/* Rental Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Rental Items *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addRentalItem} disabled={rentalProducts.length === 0}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                {rentalProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    <Link to="/products" className="text-primary hover:underline">
                      Add rental products first
                    </Link> to create rental agreements.
                  </p>
                )}

                {rentalItems.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Product *</Label>
                        <Select 
                          value={item.product} 
                          onValueChange={(value) => {
                            updateRentalItem(index, 'product', value);
                            const product = rentalProducts.find(p => p.id === value);
                            if (product) {
                              updateRentalItem(index, 'price', product.price);
                            }
                          }}
                          required
                          disabled={rentalProducts.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {rentalProducts.map(product => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} - ${product.price}/month
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateRentalItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Monthly Rate</Label>
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">
                            ${item.price * item.quantity}/month
                          </div>
                          {rentalItems.length > 1 && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeRentalItem(index)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4">

                <div className="space-y-2">
                  <Label>Contract Length *</Label>
                  <div className="flex gap-2">
                    <Select value={contractLength.split(' ')[0] || ""} onValueChange={(value) => {
                      const unit = contractLength.split(' ')[1] || 'months';
                      setContractLength(`${value} ${unit}`);
                    }}>
                      <SelectTrigger className="w-20">
                        <SelectValue placeholder="Qty" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36].map(num => (
                          <SelectItem key={num} value={num.toString()}>
                            {num}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={contractLength.split(' ')[1] || "months"} onValueChange={(value) => {
                      const number = contractLength.split(' ')[0] || '1';
                      setContractLength(`${number} ${value}`);
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
              </div>

              <div className="grid grid-cols-3 gap-4">

                <div className="space-y-2">
                  <Label>Payment Period *</Label>
                  <Select value={paymentPeriod} onValueChange={setPaymentPeriod}>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contract Start Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Contract End Date</Label>
                  <div className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                    {startDate && contractLength ? format(calculateEndDate(startDate, contractLength) || new Date(), "PPP") : "Auto-calculated"}
                  </div>
                </div>
              </div>

              {startDate && contractLength && rentalItems.some(item => item.product) && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Agreement Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Monthly Amount:</span>
                      <div className="font-bold">${rentalItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}/month</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Contract Value:</span>
                      <div className="font-bold text-success">
                        ${(() => {
                          if (startDate && contractLength) {
                            const endDate = calculateEndDate(startDate, contractLength);
                            if (endDate) {
                              const months = differenceInMonths(endDate, startDate);
                              return rentalItems.reduce((sum, item) => sum + (item.price * item.quantity * months), 0).toFixed(2);
                            }
                          }
                          return '0.00';
                        })()}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Payment Due ({paymentPeriod}):</span>
                      <div className="font-bold">
                        ${(() => {
                          if (startDate && contractLength) {
                            const endDate = calculateEndDate(startDate, contractLength);
                            if (endDate) {
                              return rentalItems.reduce((sum, item) => 
                                sum + (item.price * item.quantity * monthsInPaymentPeriod(paymentPeriod)), 0
                              ).toFixed(2);
                            }
                          }
                          return '0.00';
                        })()}/{periodShortLabel(paymentPeriod)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full">
                Create Rental Agreement
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Active Agreements
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{activeAgreements}</div>
            <p className="text-xs text-muted-foreground">
              Currently active rentals
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Monthly Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">
              ${totalMonthlyRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              From active agreements
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Total Agreements
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{rentalAgreements.length}</div>
            <p className="text-xs text-muted-foreground">
              All time agreements
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Total Active Contract Value
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">
              ${totalContractValue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Active contracts combined
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rental Agreements Table */}
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Rental Agreements Log</CardTitle>
              <CardDescription>
                All rental agreements and their current status
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search agreements..." 
                className="w-64" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAgreements.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Rental Agreements Found</h3>
              <p className="text-muted-foreground mb-4">
                {rentalAgreements.length === 0 
                  ? "Create your first rental agreement using the form above." 
                  : "No agreements match your search criteria."
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
                      <TableHead>Contract Length</TableHead>
                      <TableHead>Payment Period</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Monthly Amount</TableHead>
                      <TableHead>Total Value</TableHead>
                      <TableHead>Payment Due</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredAgreements.map((agreement) => (
                      <TableRow key={agreement.id}>
                        <TableCell className="font-medium">
                          {agreement.customer}
                        </TableCell>
                        <TableCell>{agreement.product}</TableCell>
                        <TableCell>{agreement.contractLength}</TableCell>
                        <TableCell className="capitalize">{agreement.paymentPeriod}</TableCell>
                        <TableCell>{format(agreement.startDate, 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{format(agreement.endDate, 'MMM dd, yyyy')}</TableCell>
                        <TableCell>${agreement.monthlyAmount.toFixed(2)}</TableCell>
                        <TableCell>${agreement.totalValue.toFixed(2)}</TableCell>
                        <TableCell>
                          ${(
                            agreement.monthlyAmount * monthsInPaymentPeriod(agreement.paymentPeriod)
                          ).toFixed(2)}
                          /{periodShortLabel(agreement.paymentPeriod)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(agreement.status)}>
                            {agreement.status}
                          </Badge>
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