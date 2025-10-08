import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, User, Mail, Phone, Building, Users, Edit, Trash2, Lock, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCustomers } from "@/hooks/useCustomers";

// Your customer database - ready for real data
const mockCustomers: Array<{
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
}> = [];
export default function Customers() {
  const { toast } = useToast();
  const { userDepartment, user } = useAuth();
  const { customers, loading, addCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<{
    hasAccess: boolean;
    status: 'none' | 'pending' | 'approved' | 'expired';
    expiresAt?: string;
  }>({ hasAccess: false, status: 'none' });
  const [requestingAccess, setRequestingAccess] = useState(false);

  // Check access for sales users
  useEffect(() => {
    if (userDepartment === 'sales' && user) {
      checkAccessStatus();
    }
  }, [userDepartment, user]);

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
      return;
    }

    if (!data || data.length === 0) {
      setAccessStatus({ hasAccess: false, status: 'none' });
      return;
    }

    const latestRequest = data[0];
    
    if (latestRequest.status === 'pending') {
      setAccessStatus({ hasAccess: false, status: 'pending' });
    } else if (latestRequest.status === 'approved') {
      const expiresAt = new Date(latestRequest.expires_at);
      const now = new Date();
      
      if (now < expiresAt) {
        setAccessStatus({ 
          hasAccess: true, 
          status: 'approved',
          expiresAt: latestRequest.expires_at 
        });
      } else {
        setAccessStatus({ hasAccess: false, status: 'expired' });
      }
    } else {
      setAccessStatus({ hasAccess: false, status: 'none' });
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
    if (!user || userDepartment !== 'sales') return;

    await supabase.from('customer_activity_log').insert({
      user_id: user.id,
      customer_id: customerId,
      action,
      changes
    });
  };

  // Get sales data from Supabase to calculate customer totals
  const [salesData, setSalesData] = useState<Array<{
    customer_name: string;
    total: number;
    date: string;
  }>>([]);

  useEffect(() => {
    const fetchSales = async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('customer_name, total, date');
      
      if (!error && data) {
        setSalesData(data);
      }
    };

    fetchSales();

    // Subscribe to sales changes
    const channel = supabase
      .channel('customer-sales-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'sales' },
        () => fetchSales()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Calculate actual customer sales totals
  const customersWithSales = customers.map(customer => {
    const customerSales = salesData.filter(sale => sale.customer_name === customer.name);
    const totalSales = customerSales.reduce((sum, sale) => sum + sale.total, 0);
    const lastPurchase = customerSales.length > 0 
      ? customerSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
      : customer.last_purchase;
    
    return {
      ...customer,
      totalSales: totalSales || 0,
      lastPurchase: lastPurchase || customer.last_purchase || new Date().toISOString()
    };
  });

  const filteredCustomers = customersWithSales.filter(customer => 
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    customer.company.toLowerCase().includes(searchTerm.toLowerCase()) || 
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    
    try {
      const customerData = await addCustomer({
        name: String(data.get("name") || ""),
        email: String(data.get("email") || ""),
        phone: String(data.get("phone") || ""),
        company: String(data.get("company") || ""),
        address: String(data.get("address") || ""),
        city: String(data.get("city") || ""),
        status: "active"
      });
      
      // Log activity for sales users
      if (userDepartment === 'sales' && customerData) {
        await logActivity('created', customerData.id);
      }
      
      form.reset();
      setShowForm(false);
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
        name: String(data.get("name") || ""),
        email: String(data.get("email") || ""),
        phone: String(data.get("phone") || ""),
        company: String(data.get("company") || ""),
        address: String(data.get("address") || ""),
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
  // Show access control for sales users
  if (userDepartment === 'sales' && !accessStatus.hasAccess) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Customer Database Access
            </CardTitle>
            <CardDescription>
              You need administrator approval to access the customer database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {accessStatus.status === 'none' && (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Request temporary access to view and add customers. Access will be valid until 4 PM.
                </p>
                <Button onClick={handleRequestAccess} disabled={requestingAccess}>
                  {requestingAccess ? 'Requesting...' : 'Request Access'}
                </Button>
              </div>
            )}
            {accessStatus.status === 'pending' && (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-medium mb-2">Access Request Pending</p>
                <p className="text-sm text-muted-foreground">
                  Your request is waiting for administrator approval. You'll be notified once it's processed.
                </p>
              </div>
            )}
            {accessStatus.status === 'expired' && (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Your access has expired (valid until 4 PM). Request new access to continue.
                </p>
                <Button onClick={handleRequestAccess} disabled={requestingAccess}>
                  {requestingAccess ? 'Requesting...' : 'Request New Access'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <div className="space-y-6">
      {/* Access Status Banner for Sales */}
      {userDepartment === 'sales' && accessStatus.hasAccess && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-sm font-medium">
                  You have temporary access until {accessStatus.expiresAt ? new Date(accessStatus.expiresAt).toLocaleTimeString() : '4 PM'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customer Management</h1>
          <p className="text-muted-foreground">
            Manage your customer database and track their purchase history.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? "Cancel" : "Add Customer"}
        </Button>
      </div>

      {/* Add Customer Form */}
      {showForm && <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Add New Customer</CardTitle>
            <CardDescription>
              Enter the customer's information below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Contact Name *</Label>
                  <Input id="name" name="name" placeholder="John Doe" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input id="email" name="email" type="email" placeholder="john@company.com" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" name="phone" type="tel" placeholder="+1 (555) 123-4567" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company Name *</Label>
                  <Input id="company" name="company" placeholder="ABC Corporation" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" placeholder="123 Business Avenue, Suite 100" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea id="notes" name="notes" placeholder="Any additional notes about this customer..." className="min-h-[100px]" />
              </div>

              <Button type="submit" className="w-full">
                <User className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </form>
          </CardContent>
        </Card>}

      {/* Customer List */}
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Customer Database</CardTitle>
              <CardDescription>
                {filteredCustomers.length} customers in your database
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search customers..." className="w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length > 0 ? <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Total Sales</TableHead>
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
                              <Label htmlFor={`edit-name-${customer.id}`}>Name</Label>
                              <Input
                                id={`edit-name-${customer.id}`}
                                name="name"
                                defaultValue={customer.name}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-email-${customer.id}`}>Email</Label>
                              <Input
                                id={`edit-email-${customer.id}`}
                                name="email"
                                type="email"
                                defaultValue={customer.email}
                                required
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
                              <Label htmlFor={`edit-company-${customer.id}`}>Company</Label>
                              <Input
                                id={`edit-company-${customer.id}`}
                                name="company"
                                defaultValue={customer.company}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-address-${customer.id}`}>Address</Label>
                              <Input
                                id={`edit-address-${customer.id}`}
                                name="address"
                                defaultValue={customer.address}
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
                            <p className="font-semibold">{customer.name}</p>
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
                        ${customer.totalSales.toFixed(2)}
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
                <Link to="#" onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Customer
                </Link>
              </Button>
            </div>}
        </CardContent>
      </Card>
    </div>;
}