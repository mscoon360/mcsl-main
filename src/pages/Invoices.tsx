import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, Calendar, DollarSign, User, Send, Eye, Download, Filter, Edit, Trash2 } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, addDays } from "date-fns";
import * as XLSX from 'xlsx';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  productId?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string;
  paymentTerms: string;
}

export default function Invoices() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'paid' | 'overdue'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Get customers from localStorage
  const [customers] = useLocalStorage<Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    company: string;
    address: string;
    city: string;
  }>>('dashboard-customers', []);

  // Get products for invoice items
  const [products] = useLocalStorage<Array<{
    id: string;
    name: string;
    price: number;
    description: string;
  }>>('dashboard-products', []);

  // Get rental agreements to show customer's rental items
  const [sales] = useLocalStorage<Array<{
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

  const [invoices, setInvoices] = useLocalStorage<Invoice[]>('invoices', []);

  const [newInvoice, setNewInvoice] = useState<Partial<Invoice>>({
    customerId: '',
    issueDate: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    status: 'draft',
    items: [{ description: '', quantity: 1, unitPrice: 0, total: 0, productId: '' }],
    taxRate: 10,
    notes: '',
    paymentTerms: 'Net 30'
  });

  // Get available items for the selected customer (products + rental items)
  const getAvailableItemsForCustomer = () => {
    const availableItems = [];
    
    // Add all products
    products.forEach(product => {
      availableItems.push({
        id: `product-${product.id}`,
        name: product.name,
        price: product.price,
        type: 'product',
        description: product.description || product.name
      });
    });
    
    // Add rental items for the selected customer
    if (newInvoice.customerId) {
      const customer = customers.find(c => c.id === newInvoice.customerId);
      if (customer) {
        const customerRentals = sales
          .filter(sale => sale.customer === customer.name)
          .flatMap(sale => 
            sale.items
              .filter(item => item.isRental)
              .map(item => ({
                id: `rental-${sale.id}-${item.product}`,
                name: `${item.product} (Rental)`,
                price: item.price,
                type: 'rental',
                description: `Rental service for ${item.product}`,
                contractLength: item.contractLength,
                paymentPeriod: item.paymentPeriod
              }))
          );
        
        availableItems.push(...customerRentals);
      }
    }
    
    return availableItems;
  };

  // Generate next invoice number
  const generateInvoiceNumber = () => {
    const currentYear = new Date().getFullYear();
    const existingNumbers = invoices
      .map(inv => parseInt(inv.invoiceNumber.split('-')[1]) || 0)
      .filter(num => num > 0);
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `INV-${nextNumber.toString().padStart(4, '0')}-${currentYear}`;
  };

  const calculateInvoiceTotals = (items: InvoiceItem[], taxRate: number) => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const updateInvoiceItem = (index: number, field: string, value: any) => {
    const updatedItems = [...(newInvoice.items || [])];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    
    // If selecting a product/service, auto-populate description and price
    if (field === 'productId' && value) {
      const availableItems = getAvailableItemsForCustomer();
      const selectedItem = availableItems.find(item => item.id === value);
      if (selectedItem) {
        updatedItems[index].description = selectedItem.name;
        updatedItems[index].unitPrice = selectedItem.price;
        updatedItems[index].total = updatedItems[index].quantity * selectedItem.price;
      }
    }
    
    if (field === 'quantity' || field === 'unitPrice') {
      updatedItems[index].total = updatedItems[index].quantity * updatedItems[index].unitPrice;
    }
    
    const { subtotal, taxAmount, total } = calculateInvoiceTotals(updatedItems, newInvoice.taxRate || 0);
    
    setNewInvoice({
      ...newInvoice,
      items: updatedItems,
      subtotal,
      taxAmount,
      total
    });
  };

  const addInvoiceItem = () => {
    const updatedItems = [...(newInvoice.items || []), { description: '', quantity: 1, unitPrice: 0, total: 0, productId: '' }];
    setNewInvoice({ ...newInvoice, items: updatedItems });
  };

  const removeInvoiceItem = (index: number) => {
    const updatedItems = (newInvoice.items || []).filter((_, i) => i !== index);
    const { subtotal, taxAmount, total } = calculateInvoiceTotals(updatedItems, newInvoice.taxRate || 0);
    
    setNewInvoice({
      ...newInvoice,
      items: updatedItems,
      subtotal,
      taxAmount,
      total
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newInvoice.customerId || !newInvoice.items?.length) {
      toast({
        title: "Missing Information",
        description: "Please select a customer and add at least one item.",
        variant: "destructive"
      });
      return;
    }

    const customer = customers.find(c => c.id === newInvoice.customerId);
    if (!customer) return;

    const invoice: Invoice = {
      id: editingInvoice?.id || Date.now().toString(),
      invoiceNumber: editingInvoice?.invoiceNumber || generateInvoiceNumber(),
      customerId: newInvoice.customerId!,
      customerName: customer.name,
      issueDate: newInvoice.issueDate!,
      dueDate: newInvoice.dueDate!,
      status: newInvoice.status as Invoice['status'],
      items: newInvoice.items || [],
      subtotal: newInvoice.subtotal || 0,
      taxRate: newInvoice.taxRate || 0,
      taxAmount: newInvoice.taxAmount || 0,
      total: newInvoice.total || 0,
      notes: newInvoice.notes,
      paymentTerms: newInvoice.paymentTerms || 'Net 30'
    };

    if (editingInvoice) {
      setInvoices(prev => prev.map(inv => inv.id === editingInvoice.id ? invoice : inv));
      toast({
        title: "Invoice Updated",
        description: `Invoice ${invoice.invoiceNumber} has been updated successfully.`
      });
    } else {
      setInvoices(prev => [...prev, invoice]);
      toast({
        title: "Invoice Created",
        description: `Invoice ${invoice.invoiceNumber} has been created successfully.`
      });
    }

    resetForm();
  };

  const resetForm = () => {
    setNewInvoice({
      customerId: '',
      issueDate: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      status: 'draft',
      items: [{ description: '', quantity: 1, unitPrice: 0, total: 0, productId: '' }],
      taxRate: 10,
      notes: '',
      paymentTerms: 'Net 30'
    });
    setShowForm(false);
    setEditingInvoice(null);
  };

  const editInvoice = (invoice: Invoice) => {
    setNewInvoice({
      customerId: invoice.customerId,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      items: invoice.items,
      subtotal: invoice.subtotal,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      notes: invoice.notes,
      paymentTerms: invoice.paymentTerms
    });
    setEditingInvoice(invoice);
    setShowForm(true);
  };

  const deleteInvoice = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
    toast({
      title: "Invoice Deleted",
      description: `Invoice ${invoice.invoiceNumber} has been deleted.`
    });
  };

  const updateInvoiceStatus = (invoiceId: string, status: Invoice['status']) => {
    setInvoices(prev => prev.map(inv => 
      inv.id === invoiceId ? { ...inv, status } : inv
    ));
    
    const invoice = invoices.find(inv => inv.id === invoiceId);
    toast({
      title: "Status Updated",
      description: `Invoice ${invoice?.invoiceNumber} marked as ${status}.`
    });
  };

  const exportInvoices = () => {
    const exportData = filteredInvoices.map(invoice => ({
      'Invoice Number': invoice.invoiceNumber,
      'Customer': invoice.customerName,
      'Issue Date': format(parseISO(invoice.issueDate), 'MM/dd/yyyy'),
      'Due Date': format(parseISO(invoice.dueDate), 'MM/dd/yyyy'),
      'Status': invoice.status.toUpperCase(),
      'Subtotal': invoice.subtotal,
      'Tax': invoice.taxAmount,
      'Total': invoice.total,
      'Payment Terms': invoice.paymentTerms
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    ws['!cols'] = [
      { width: 18 }, { width: 20 }, { width: 12 }, { width: 12 }, 
      { width: 10 }, { width: 12 }, { width: 10 }, { width: 12 }, { width: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `Invoices_${format(new Date(), 'yyyy_MM_dd')}.xlsx`);

    toast({
      title: "Export Complete",
      description: "Invoices exported to Excel successfully."
    });
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(invoice => {
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    const matchesSearch = searchTerm === '' || 
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate statistics
  const totalInvoices = invoices.length;
  const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
  const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length;
  const totalRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0);

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Invoice Management</h1>
          <p className="text-muted-foreground">Create, manage, and track customer invoices</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportInvoices}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Cancel" : "New Invoice"}
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Paid Invoices</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paidInvoices}</div>
            <p className="text-xs text-muted-foreground">
              {totalInvoices > 0 ? ((paidInvoices / totalInvoices) * 100).toFixed(1) : '0'}% of total
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Overdue</CardTitle>
            <Calendar className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueInvoices}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">From paid invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Form */}
      {showForm && (
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">
              {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
            </CardTitle>
            <CardDescription>
              {editingInvoice ? 'Update invoice details' : 'Enter invoice information and line items'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer and Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select 
                    value={newInvoice.customerId} 
                    onValueChange={(value) => setNewInvoice({...newInvoice, customerId: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} - {customer.company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Issue Date *</Label>
                  <Input
                    type="date"
                    value={newInvoice.issueDate}
                    onChange={(e) => setNewInvoice({...newInvoice, issueDate: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Due Date *</Label>
                  <Input
                    type="date"
                    value={newInvoice.dueDate}
                    onChange={(e) => setNewInvoice({...newInvoice, dueDate: e.target.value})}
                    required
                  />
                </div>
              </div>

              {/* Invoice Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">Invoice Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addInvoiceItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                {newInvoice.items?.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-5 gap-4 items-end">
                      <div className="space-y-2">
                        <Label>Product/Service</Label>
                        <Select
                          value={item.productId || ''}
                          onValueChange={(value) => updateInvoiceItem(index, 'productId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select item or custom" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Custom Item</SelectItem>
                            {getAvailableItemsForCustomer().map(availableItem => (
                              <SelectItem key={availableItem.id} value={availableItem.id}>
                                <div className="flex items-center gap-2">
                                  <span>{availableItem.name}</span>
                                  {availableItem.type === 'rental' && (
                                    <Badge variant="outline" className="text-xs">Rental</Badge>
                                  )}
                                  <span className="text-muted-foreground text-sm">
                                    ${availableItem.price.toFixed(2)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {(!item.productId || item.productId === '') && (
                          <Input
                            value={item.description}
                            onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)}
                            placeholder="Custom description"
                            className="mt-2"
                          />
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateInvoiceItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Unit Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateInvoiceItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Total</Label>
                        <div className="font-bold text-lg">${item.total.toFixed(2)}</div>
                      </div>
                      
                      <div>
                        {(newInvoice.items?.length || 0) > 1 && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeInvoiceItem(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}

                {/* Invoice Totals */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4 max-w-md ml-auto">
                    <div className="space-y-2">
                      <Label>Tax Rate (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={newInvoice.taxRate}
                        onChange={(e) => {
                          const taxRate = parseFloat(e.target.value) || 0;
                          const { subtotal, taxAmount, total } = calculateInvoiceTotals(newInvoice.items || [], taxRate);
                          setNewInvoice({...newInvoice, taxRate, subtotal, taxAmount, total});
                        }}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>${(newInvoice.subtotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>${(newInvoice.taxAmount || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span>${(newInvoice.total || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <Select
                    value={newInvoice.paymentTerms}
                    onValueChange={(value) => setNewInvoice({...newInvoice, paymentTerms: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 60">Net 60</SelectItem>
                      <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={newInvoice.status}
                    onValueChange={(value: Invoice['status']) => setNewInvoice({...newInvoice, status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={newInvoice.notes}
                  onChange={(e) => setNewInvoice({...newInvoice, notes: e.target.value})}
                  placeholder="Additional notes or terms..."
                />
              </div>

              <Button type="submit" className="w-full">
                {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="dashboard-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={(value: typeof statusFilter) => setStatusFilter(value)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Invoices</CardTitle>
          <CardDescription>
            {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No invoices found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {invoice.customerName}
                      </div>
                    </TableCell>
                    <TableCell>{format(parseISO(invoice.issueDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{format(parseISO(invoice.dueDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(invoice.status)}>
                        {invoice.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">${invoice.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => editInvoice(invoice)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {invoice.status !== 'paid' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateInvoiceStatus(invoice.id, 'paid')}
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteInvoice(invoice.id)}
                          className="hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}