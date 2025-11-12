import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, User, Mail, Phone, Building, Users, Edit, Trash2, Lock, Clock, CheckCircle, X, AlertCircle, FileText, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCustomers } from "@/hooks/useCustomers";
import { Checkbox } from "@/components/ui/checkbox";

// Your customer database - ready for real data
const mockCustomers: Array<{
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  totalContractValue: number;
  lastPurchase: string;
  status: string;
}> = [];
export default function Customers() {
  const { toast } = useToast();
  const { userDepartment, user } = useAuth();
  const { customers, loading, addCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    company: '', name: '', email: '', phone: '', address: '', address_2: '', zone: '', city: '', vatable: false
  });
  const [accessStatus, setAccessStatus] = useState<'none' | 'pending' | 'approved' | 'denied'>('none');
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerDetails, setCustomerDetails] = useState<{
    salesRep: string;
    contracts: any[];
    purchases: any[];
  }>({ salesRep: '', contracts: [], purchases: [] });

  const department = userDepartment;

  // Check access for sales users
  useEffect(() => {
    if (department === 'sales' && user) {
      checkAccessStatus();
    } else if (department !== 'sales') {
      setAccessStatus('approved'); // Non-sales have automatic access
    }
  }, [department, user]);

  const checkAccessStatus = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('access_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('requested_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Failed to check access status:', error);
      setAccessStatus('denied');
      return;
    }

    if (!data || data.length === 0) {
      setAccessStatus('denied');
      return;
    }

    const latestRequest = data[0];
    
    if (latestRequest.status === 'pending') {
      setAccessStatus('pending');
    } else if (latestRequest.status === 'approved') {
      const expiresAt = new Date(latestRequest.expires_at);
      const now = new Date();
      
      if (now < expiresAt) {
        setAccessStatus('approved');
      } else {
        setAccessStatus('denied');
      }
    } else {
      setAccessStatus('denied');
    }
  };

  const handleRequestAccess = async () => {
    if (!user) return;
    
    setRequestingAccess(true);

    const { error } = await supabase
      .from('access_requests')
      .insert({
        user_id: user.id,
        status: 'pending'
      });

    if (error) {
      toast({
        title: "Request Failed",
        description: "Failed to submit access request. Please try again.",
        variant: "destructive"
      });
      console.error(error);
    } else {
      toast({
        title: "Access Requested",
        description: "Your request has been sent to an administrator for approval."
      });
      checkAccessStatus();
    }

    setRequestingAccess(false);
  };

  const logActivity = async (action: 'created' | 'updated' | 'deleted', customerId: string, changes?: any) => {
    if (!user || department !== 'sales') return;

    await supabase.from('customer_activity_log').insert({
      user_id: user.id,
      customer_id: customerId,
      action,
      changes
    });
  };

  // Get contract data from Supabase to calculate customer contract totals
  const [contractData, setContractData] = useState<Array<{
    customer_name: string;
    total: number;
    date: string;
  }>>([]);

  useEffect(() => {
    const fetchContracts = async () => {
      // Fetch rental sales (contracts) with their totals
      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          price,
          quantity,
          sales!inner(customer_name, date)
        `)
        .eq('is_rental', true);
      
      if (!error && data) {
        // Transform data to calculate contract totals per customer
        const contractsByCustomer = data.reduce((acc: any[], item: any) => {
          const customerName = item.sales.customer_name;
          const total = item.price * item.quantity;
          const date = item.sales.date;
          
          acc.push({ customer_name: customerName, total, date });
          return acc;
        }, []);
        
        setContractData(contractsByCustomer);
      }
    };

    fetchContracts();

    // Subscribe to sales and sale_items changes
    const salesChannel = supabase
      .channel('customer-contracts-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'sales' },
        () => fetchContracts()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'sale_items' },
        () => fetchContracts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(salesChannel);
    };
  }, []);

  // Calculate actual customer contract values
  const customersWithContracts = customers.map(customer => {
    const customerContracts = contractData.filter(contract => contract.customer_name === customer.name);
    const totalContractValue = customerContracts.reduce((sum, contract) => sum + contract.total, 0);
    const lastPurchase = customerContracts.length > 0 
      ? customerContracts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
      : customer.last_purchase;
    
    return {
      ...customer,
      totalContractValue: totalContractValue || 0,
      lastPurchase: lastPurchase || customer.last_purchase || new Date().toISOString()
    };
  });

  const filteredCustomers = customersWithContracts.filter(customer => 
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    customer.company?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const customerData = await addCustomer({
        company: formData.company,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || '',
        address: formData.address || '',
        address_2: formData.address_2 || '',
        zone: formData.zone || '',
        city: formData.city || '',
        status: "active",
        vatable: formData.vatable
      });
      
      // Log activity for sales users
      if (department === 'sales' && customerData) {
        await logActivity('created', customerData.id);
      }
      
      setFormData({ company: '', name: '', email: '', phone: '', address: '', address_2: '', zone: '', city: '', vatable: false });
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add customer:', error);
    }
  };

  const handleEdit = (customer: { id: string }) => {
    setEditingCustomer(customer.id);
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    
    if (!editingCustomer) return;
    
    try {
      await updateCustomer(editingCustomer, {
        company: String(data.get("company") || ""),
        name: String(data.get("name") || ""),
        email: String(data.get("email") || ""),
        phone: String(data.get("phone") || ""),
        address: String(data.get("address") || ""),
        address_2: String(data.get("address_2") || ""),
        zone: String(data.get("zone") || ""),
        city: String(data.get("city") || "")
      });

      setEditingCustomer(null);
    } catch (error) {
      console.error('Failed to update customer:', error);
    }
  };

  const handleDelete = async (customerId: string) => {
    if (window.confirm("Are you sure you want to delete this customer?")) {
      try {
        await deleteCustomer(customerId);
      } catch (error) {
        console.error('Failed to delete customer:', error);
      }
    }
  };

  const handleCustomerClick = async (customer: any) => {
    setSelectedCustomer(customer);
    setIsDetailsDialogOpen(true);

    // Fetch sales rep who added this customer
    const { data: profileData } = await supabase
      .from('profiles')
      .select('name, username')
      .eq('id', customer.user_id)
      .single();

    // Fetch contracts (rental agreements with this customer)
    const { data: contractsData } = await supabase
      .from('sale_items')
      .select(`
        *,
        sales!inner(customer_name, date, total)
      `)
      .eq('sales.customer_name', customer.name)
      .eq('is_rental', true);

    // Fetch purchases (all sales for this customer)
    const { data: purchasesData } = await supabase
      .from('sales')
      .select(`
        *,
        sale_items(product_name, quantity, price)
      `)
      .eq('customer_name', customer.name)
      .order('date', { ascending: false });

    setCustomerDetails({
      salesRep: profileData?.name || profileData?.username || 'Unknown',
      contracts: contractsData || [],
      purchases: purchasesData || []
    });
  };
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">
          Manage your customer database and relationships
        </p>
      </div>

        {/* Sales users can always add customers */}
        {department === 'sales' && (
          <Card>
            <CardHeader>
              <CardTitle>Add New Customer</CardTitle>
              <CardDescription>
                Add a new customer to the database. Viewing and editing existing customers requires access approval.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company">Company Name *</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">Representative Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address #1</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="address_2">Address #2</Label>
                    <Input
                      id="address_2"
                      value={formData.address_2}
                      onChange={(e) => setFormData({ ...formData, address_2: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="zone">Zone</Label>
                    <Input
                      id="zone"
                      value={formData.zone}
                      onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="vatable" 
                    checked={formData.vatable}
                    onCheckedChange={(checked) => setFormData({ ...formData, vatable: checked as boolean })}
                  />
                  <Label htmlFor="vatable" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    VATable Customer (12.5% VAT will be applied to purchases)
                  </Label>
                </div>
                <Button type="submit">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Customer
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Access status messages for sales users */}
        {department === 'sales' && accessStatus === 'pending' && (
          <Card className="border-yellow-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Access Request Pending
              </CardTitle>
              <CardDescription>
                Your request to view and edit customers is awaiting admin approval.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {department === 'sales' && accessStatus === 'denied' && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Access Required to View Customers
              </CardTitle>
              <CardDescription>
                You need administrator approval to view and edit existing customers in the database.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleRequestAccess} className="w-full">
                <Clock className="mr-2 h-4 w-4" />
                Request Access to View Customers
              </Button>
            </CardContent>
          </Card>
        )}

        {department === 'sales' && accessStatus === 'approved' && (
          <Card className="border-green-500 bg-green-50 dark:bg-green-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                Access Granted to View/Edit Customers
              </CardTitle>
              <CardDescription className="text-green-600 dark:text-green-500">
                You have temporary access to view and edit the customer database
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Main Content - Only show if user has access */}
        {(department !== 'sales' || accessStatus === 'approved') && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Customer Database</h2>
                <p className="text-muted-foreground text-sm">
                  {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} found
                </p>
              </div>
              {department !== 'sales' && (
                <Button onClick={() => setShowAddForm(!showAddForm)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {showAddForm ? 'Cancel' : 'Add Customer'}
                </Button>
              )}
            </div>

            {/* Add customer form for non-sales */}
            {showAddForm && department !== 'sales' && (
              <Card>
                <CardHeader>
                  <CardTitle>Add New Customer</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="company-form">Company Name *</Label>
                        <Input
                          id="company-form"
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="name-form">Representative Name</Label>
                        <Input
                          id="name-form"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email-form">Email</Label>
                        <Input
                          id="email-form"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone-form">Phone</Label>
                        <Input
                          id="phone-form"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="address-form">Address #1</Label>
                        <Input
                          id="address-form"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="address_2-form">Address #2</Label>
                        <Input
                          id="address_2-form"
                          value={formData.address_2}
                          onChange={(e) => setFormData({ ...formData, address_2: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="city-form">City</Label>
                        <Input
                          id="city-form"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="zone-form">Zone</Label>
                        <Input
                          id="zone-form"
                          value={formData.zone}
                          onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="vatable-form" 
                        checked={formData.vatable}
                        onCheckedChange={(checked) => setFormData({ ...formData, vatable: checked as boolean })}
                      />
                      <Label htmlFor="vatable-form" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        VATable Customer (12.5% VAT will be applied to purchases)
                      </Label>
                    </div>
                    <Button type="submit">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Customer
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Search Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers by name, email, company, or city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchTerm && (
                <Button variant="ghost" size="icon" onClick={() => setSearchTerm('')}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Card>
        <CardContent>
          {filteredCustomers.length > 0 ? <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Total Contract Value</TableHead>
                  <TableHead>Last Purchase</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map(customer => (
                  editingCustomer === customer.id ? (
                    <TableRow key={customer.id}>
                      <TableCell colSpan={7} className="p-4">
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor={`edit-company-${customer.id}`}>Company *</Label>
                              <Input
                                id={`edit-company-${customer.id}`}
                                name="company"
                                defaultValue={customer.company}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-name-${customer.id}`}>Representative Name</Label>
                              <Input
                                id={`edit-name-${customer.id}`}
                                name="name"
                                defaultValue={customer.name}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-email-${customer.id}`}>Email</Label>
                              <Input
                                id={`edit-email-${customer.id}`}
                                name="email"
                                type="email"
                                defaultValue={customer.email}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-phone-${customer.id}`}>Phone</Label>
                              <Input
                                id={`edit-phone-${customer.id}`}
                                name="phone"
                                defaultValue={customer.phone}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-address-${customer.id}`}>Address #1</Label>
                              <Input
                                id={`edit-address-${customer.id}`}
                                name="address"
                                defaultValue={customer.address}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-address-2-${customer.id}`}>Address #2</Label>
                              <Input
                                id={`edit-address-2-${customer.id}`}
                                name="address_2"
                                defaultValue={customer.address_2}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-city-${customer.id}`}>City</Label>
                              <Input
                                id={`edit-city-${customer.id}`}
                                name="city"
                                defaultValue={customer.city}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-zone-${customer.id}`}>Zone</Label>
                              <Input
                                id={`edit-zone-${customer.id}`}
                                name="zone"
                                defaultValue={customer.zone}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" size="sm">Save</Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingCustomer(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <button 
                              onClick={() => handleCustomerClick(customer)}
                              className="font-semibold hover:underline text-left cursor-pointer"
                            >
                              {customer.name}
                            </button>
                            <p className="text-sm text-muted-foreground">{customer.city}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {customer.email}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {customer.phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          {customer.company}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-success">
                        ${customer.totalContractValue.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {new Date(customer.lastPurchase).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                          {customer.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(customer)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(customer.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                ))}
              </TableBody>
            </Table> : <div className="text-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No customers yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Start building your customer database by adding your first customer. All customer information will be stored securely.
              </p>
              <Button asChild>
                <Link to="#" onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Customer
                </Link>
              </Button>
            </div>}
        </CardContent>
      </Card>
          </>
        )}

      {/* Customer Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Customer Details</DialogTitle>
            <DialogDescription>Complete information about this customer</DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Representative Name</p>
                    <p className="font-medium">{selectedCustomer.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedCustomer.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedCustomer.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="font-medium">{selectedCustomer.company || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{selectedCustomer.address || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">City</p>
                    <p className="font-medium">{selectedCustomer.city || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Contract Value</p>
                    <p className="font-medium text-success">${selectedCustomer.totalContractValue?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={selectedCustomer.status === 'active' ? 'default' : 'secondary'}>
                      {selectedCustomer.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Sales Rep */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Added By
                </h3>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="font-medium">{customerDetails.salesRep}</p>
                </div>
              </div>

              <Separator />

              {/* Contracts */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Rental Contracts ({customerDetails.contracts.length})
                </h3>
                {customerDetails.contracts.length > 0 ? (
                  <div className="space-y-2">
                    {customerDetails.contracts.map((contract, idx) => (
                      <div key={idx} className="bg-muted/50 p-3 rounded-lg flex justify-between items-center">
                        <div>
                          <p className="font-medium">{contract.product_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {contract.start_date ? new Date(contract.start_date).toLocaleDateString() : 'N/A'} - {contract.end_date ? new Date(contract.end_date).toLocaleDateString() : 'Ongoing'}
                          </p>
                        </div>
                        <p className="font-semibold">${contract.price?.toFixed(2) || '0.00'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm bg-muted/50 p-4 rounded-lg">No rental contracts found</p>
                )}
              </div>

              <Separator />

              {/* Purchases */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Purchase History ({customerDetails.purchases.length})
                </h3>
                {customerDetails.purchases.length > 0 ? (
                  <div className="space-y-3">
                    {customerDetails.purchases.map((purchase) => (
                      <div key={purchase.id} className="bg-muted/50 p-3 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">Sale #{purchase.id.slice(0, 8)}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(purchase.date).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge>{purchase.status}</Badge>
                        </div>
                        {purchase.sale_items && purchase.sale_items.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {purchase.sale_items.map((item: any, idx: number) => (
                              <div key={idx} className="text-sm flex justify-between">
                                <span>{item.product_name} x{item.quantity}</span>
                                <span className="text-muted-foreground">${item.price?.toFixed(2) || '0.00'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 pt-2 border-t border-border">
                          <div className="flex justify-between font-semibold">
                            <span>Total</span>
                            <span className="text-success">${purchase.total?.toFixed(2) || '0.00'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm bg-muted/50 p-4 rounded-lg">No purchases found</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
  );
}