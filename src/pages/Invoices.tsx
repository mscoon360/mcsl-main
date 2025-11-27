import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, Calendar, DollarSign, User, Send, Eye, Download, Filter, Edit, Trash2, Check } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, parseISO, addDays } from "date-fns";
import * as XLSX from 'xlsx';
import { PDFDocument, rgb } from 'pdf-lib';
import { supabase } from "@/integrations/supabase/client";
import { useCustomers } from "@/hooks/useCustomers";
import { useProducts } from "@/hooks/useProducts";
import { useSales } from "@/hooks/useSales";
import invoiceTemplate from '@/assets/invoice-template.pdf';
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
  const {
    toast
  } = useToast();
  const {
    user,
    isAdmin
  } = useAuth();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'paid' | 'overdue'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [salesWithInvoices, setSalesWithInvoices] = useState<Set<string>>(new Set());

  // Check access permissions
  useEffect(() => {
    const checkAccess = async () => {
      if (!user || isAdmin) return;
      const {
        data
      } = await supabase.from('department_visibility').select('department').eq('user_id', user.id);
      const allowedSections = data?.map(d => d.department) || [];
      const hasAccess = allowedSections.includes('Finance-Invoices') || allowedSections.includes('Finance');
      if (!hasAccess && allowedSections.length > 0) {
        navigate('/');
      }
    };
    checkAccess();
  }, [user, isAdmin, navigate]);

  // Get customers from Supabase
  const {
    customers
  } = useCustomers();

  // Get products from Supabase
  const {
    products
  } = useProducts();

  // Get sales log from Supabase (renamed to avoid conflict with rental sales)
  const {
    sales: salesLog,
    loading: salesLoading
  } = useSales();

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
    items: [{
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      productId: 'custom'
    }],
    taxRate: 10,
    notes: '',
    paymentTerms: 'Cash'
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
        description: product.description || product.name,
        displayPrice: product.price,
        paymentPeriod: null
      });
    });

    // Add separator if we have both products and rentals
    if (products.length > 0 && newInvoice.customerId) {
      const customer = customers.find(c => c.id === newInvoice.customerId);
      if (customer) {
        const hasRentals = sales.some(sale => sale.customer === customer.name && sale.items.some(item => item.isRental));
        if (hasRentals) {
          availableItems.push({
            id: 'separator',
            name: '--- Rental Agreements ---',
            price: 0,
            type: 'separator',
            description: '',
            displayPrice: 0,
            paymentPeriod: null
          });
        }
      }
    }

    // Add rental items for the selected customer with proper payment due calculation
    if (newInvoice.customerId) {
      const customer = customers.find(c => c.id === newInvoice.customerId);
      if (customer) {
        const customerRentals = sales.filter(sale => sale.customer === customer.name).flatMap(sale => sale.items.filter(item => item.isRental).map(item => {
          // Calculate payment due: monthly price * months in payment period
          const monthsInPeriod = getMonthsInPaymentPeriod(item.paymentPeriod || 'monthly');
          const paymentDue = item.price * monthsInPeriod;
          const periodDisplay = item.paymentPeriod ? `/${getPeriodShortLabel(item.paymentPeriod)}` : '';
          return {
            id: `rental-${sale.id}-${item.product}`,
            name: `${item.product} (Rental)`,
            price: paymentDue,
            // Use the calculated payment due amount
            type: 'rental',
            description: `Rental service for ${item.product}`,
            contractLength: item.contractLength,
            paymentPeriod: item.paymentPeriod,
            displayPrice: paymentDue,
            originalPrice: item.price
          };
        }));
        availableItems.push(...customerRentals);
      }
    }
    return availableItems;
  };

  // Helper functions for payment period calculations
  const getMonthsInPaymentPeriod = (period: string) => {
    switch (period?.toLowerCase()) {
      case 'monthly':
        return 1;
      case 'quarterly':
        return 3;
      case 'biannually':
      case 'bi-annually':
        return 6;
      case 'annually':
      case 'yearly':
        return 12;
      default:
        return 1;
    }
  };
  const getPeriodShortLabel = (period: string) => {
    const p = period?.toLowerCase();
    if (p === 'monthly') return 'month';
    if (p === 'quarterly') return 'quarter';
    if (p === 'biannually' || p === 'bi-annually') return 'biannual';
    if (p === 'annually' || p === 'yearly') return 'year';
    return p || 'period';
  };

  // Generate next invoice number
  const generateInvoiceNumber = () => {
    const currentYear = new Date().getFullYear();
    const existingNumbers = invoices.map(inv => parseInt(inv.invoiceNumber.split('-')[1]) || 0).filter(num => num > 0);
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `INV-${nextNumber.toString().padStart(4, '0')}-${currentYear}`;
  };
  const calculateInvoiceTotals = (items: InvoiceItem[], taxRate: number) => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subtotal * taxRate / 100;
    const total = subtotal + taxAmount;
    return {
      subtotal,
      taxAmount,
      total
    };
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
        // Get product units if it's a product type
        let units = '';
        if (selectedItem.type === 'product') {
          const productId = selectedItem.id.replace('product-', '');
          const product = products.find(p => p.id === productId);
          units = product?.units || '';
        }

        // Format description as "quantity units productName" (e.g., "2 C/S test 1")
        const quantity = updatedItems[index].quantity || 1;
        const formattedDescription = units ? `${quantity} ${units} ${selectedItem.name}` : `${quantity} ${selectedItem.name}`;
        updatedItems[index].description = formattedDescription;
        updatedItems[index].unitPrice = selectedItem.price;
        updatedItems[index].total = quantity * selectedItem.price;
      }
    }

    // Update description when quantity changes
    if (field === 'quantity' && updatedItems[index].productId && updatedItems[index].productId !== 'custom') {
      const availableItems = getAvailableItemsForCustomer();
      const selectedItem = availableItems.find(item => item.id === updatedItems[index].productId);
      if (selectedItem) {
        let units = '';
        if (selectedItem.type === 'product') {
          const productId = selectedItem.id.replace('product-', '');
          const product = products.find(p => p.id === productId);
          units = product?.units || '';
        }
        const formattedDescription = units ? `${value} ${units} ${selectedItem.name}` : `${value} ${selectedItem.name}`;
        updatedItems[index].description = formattedDescription;
      }
    }
    if (field === 'quantity' || field === 'unitPrice') {
      updatedItems[index].total = updatedItems[index].quantity * updatedItems[index].unitPrice;
    }
    const {
      subtotal,
      taxAmount,
      total
    } = calculateInvoiceTotals(updatedItems, newInvoice.taxRate || 0);
    setNewInvoice({
      ...newInvoice,
      items: updatedItems,
      subtotal,
      taxAmount,
      total
    });
  };
  const addInvoiceItem = () => {
    const updatedItems = [...(newInvoice.items || []), {
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      productId: 'custom'
    }];
    setNewInvoice({
      ...newInvoice,
      items: updatedItems
    });
  };
  const removeInvoiceItem = (index: number) => {
    const updatedItems = (newInvoice.items || []).filter((_, i) => i !== index);
    const {
      subtotal,
      taxAmount,
      total
    } = calculateInvoiceTotals(updatedItems, newInvoice.taxRate || 0);
    setNewInvoice({
      ...newInvoice,
      items: updatedItems,
      subtotal,
      taxAmount,
      total
    });
  };
  const generateInvoicePDF = async (invoice: Invoice) => {
    try {
      // Load the template PDF
      const templateBytes = await fetch(invoiceTemplate).then(res => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(templateBytes);

      // Get the form from the PDF
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      // Log all field names to help with debugging
      console.log('Available form fields:', fields.map(f => f.getName()));

      // Helper to safely set a field if it exists
      const setField = (name: string, value: string) => {
        try {
          form.getTextField(name).setText(value);
        } catch {
          console.log(`${name} field not found`);
        }
      };

      // Customer details - fill multiple possible field names for compatibility
      const customer = customers.find(c => c.id === invoice.customerId);
      setField('Customer Name', invoice.customerName);
      const companyInfo = customer?.company || '';
      const addressInfo = customer?.address || '';

      // If separate fields exist, set them
      setField('Company Name', companyInfo);
      setField('Company Address', addressInfo); // legacy template
      setField('Address', addressInfo); // current template field name

      // If a combined field exists, set company on first line and address on second (only if present)
      const billToCombined = addressInfo ? `${companyInfo}\n${addressInfo}` : companyInfo;
      setField('Company Name, Address', billToCombined);

      // Header fields (from template: Text17, Text18)
      setField('Text17', format(parseISO(invoice.issueDate), 'dd/MM/yyyy')); // Invoice Date
      setField('Text18', invoice.invoiceNumber); // Invoice Number

      // Line items mapping to Item 1..10 and Amount 1..10
      for (let i = 0; i < 10; i++) {
        const item = invoice.items[i];
        setField(`Item ${i + 1}`, item?.description ? String(item.description) : '');
        setField(`Amount ${i + 1}`, item ? item.total.toFixed(2) : '');
      }

      // Totals area (bottom fields: Text41, Text42, Text43)
      setField('Text41', invoice.subtotal.toFixed(2));
      setField('Text42', invoice.taxAmount.toFixed(2));
      setField('Text43', invoice.total.toFixed(2));

      // Flatten to make entries non-editable
      form.flatten();

      // Save the filled PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], {
        type: 'application/pdf'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice_${invoice.invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      console.log('PDF generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "PDF Generation Error",
        description: "There was an issue generating the PDF. Please try again.",
        variant: "destructive"
      });
    }
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
      paymentTerms: newInvoice.paymentTerms || 'Cash'
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
        description: `Invoice ${invoice.invoiceNumber} has been created and PDF downloaded.`
      });

      // Generate and download PDF for new invoices
      generateInvoicePDF(invoice);

      // Track if this invoice was created from a sale (capture any ID format)
      const saleIdMatch = invoice.notes?.match(/Sale ID: (.+)/);
      const matchedId = saleIdMatch?.[1]?.trim();
      if (matchedId) {
        setSalesWithInvoices(prev => {
          const next = new Set(prev);
          next.add(String(matchedId));
          return next;
        });
      }
    }
    resetForm();
  };
  const resetForm = () => {
    setNewInvoice({
      customerId: '',
      issueDate: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      status: 'draft',
      items: [{
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0,
        productId: 'custom'
      }],
      taxRate: 10,
      notes: '',
      paymentTerms: 'Cash'
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
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? {
      ...inv,
      status
    } : inv));
    const invoice = invoices.find(inv => inv.id === invoiceId);
    toast({
      title: "Status Updated",
      description: `Invoice ${invoice?.invoiceNumber} marked as ${status}.`
    });
  };
  const handleCreateInvoiceFromSale = (sale: typeof salesLog[0]) => {
    // Find customer by name
    const customer = customers.find(c => c.name === sale.customer_name);
    if (customer) {
      // Convert sale items to invoice items
      const invoiceItems = sale.items.map(item => ({
        description: item.product_name,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.quantity * item.price,
        productId: 'custom'
      }));
      const {
        subtotal,
        taxAmount,
        total
      } = calculateInvoiceTotals(invoiceItems, 10);

      // Auto-fill the form
      setNewInvoice({
        customerId: customer.id,
        issueDate: format(new Date(sale.date), 'yyyy-MM-dd'),
        dueDate: format(addDays(new Date(sale.date), 30), 'yyyy-MM-dd'),
        status: 'draft',
        items: invoiceItems,
        taxRate: 10,
        subtotal,
        taxAmount,
        total,
        notes: `Invoice created from Sale ID: ${sale.id}`,
        paymentTerms: 'Cash'
      });
      setShowForm(true);
      toast({
        title: "Invoice Auto-filled",
        description: `Invoice form has been populated with data from the sale to ${sale.customer_name}.`
      });
    }
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
    ws['!cols'] = [{
      width: 18
    }, {
      width: 20
    }, {
      width: 12
    }, {
      width: 12
    }, {
      width: 10
    }, {
      width: 12
    }, {
      width: 10
    }, {
      width: 12
    }, {
      width: 15
    }];
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
    const matchesSearch = searchTerm === '' || invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate statistics
  const totalInvoices = invoices.length;
  const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
  const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length;
  const totalRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0);
  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'sent':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  return <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="mobile-heading font-bold text-foreground">Invoice Management</h1>
          <p className="text-muted-foreground text-sm md:text-base">Create, manage, and track customer invoices</p>
        </div>
        <div className="mobile-button-group">
          <Button variant="outline" onClick={exportInvoices} className="touch-button">
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button onClick={() => setShowForm(!showForm)} className="touch-button">
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Cancel" : "New Invoice"}
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="mobile-stats-grid mb-6">
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-card-foreground">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-blue-600">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-card-foreground">Paid Invoices</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-green-600">{paidInvoices}</div>
            <p className="text-xs text-muted-foreground">
              {totalInvoices > 0 ? (paidInvoices / totalInvoices * 100).toFixed(1) : '0'}% of total
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-card-foreground">Overdue</CardTitle>
            <Calendar className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-red-600">{overdueInvoices}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-card-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-success">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">From paid invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Log - Create Invoices from Completed Sales */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sales Log
          </CardTitle>
          <CardDescription>
            Create invoices from completed sales
          </CardDescription>
        </CardHeader>
        <CardContent>
          {salesLoading ? <div className="text-center py-8">
              <p className="text-muted-foreground">Loading sales...</p>
            </div> : salesLog.filter(sale => sale.status === 'completed').length > 0 ? <Table>
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
                {salesLog.filter(sale => sale.status === 'completed').map(sale => <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.customer_name}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {sale.items.map((item, idx) => <div key={idx} className="text-sm">
                            {item.quantity}x {item.product_name}
                          </div>)}
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
                        variant={salesWithInvoices.has(String(sale.id)) ? "secondary" : "default"} 
                        onClick={() => handleCreateInvoiceFromSale(sale)} 
                        className="gap-2"
                        disabled={salesWithInvoices.has(String(sale.id))}
                      >
                        {salesWithInvoices.has(String(sale.id)) ? (
                          <>
                            <FileText className="h-4 w-4" />
                            Invoice Generated
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Create Invoice
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table> : <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No completed sales found</p>
            </div>}
        </CardContent>
      </Card>

      {/* Invoice Form */}
      {showForm && <Card className="dashboard-card">
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
              <div className="mobile-form-grid">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select value={newInvoice.customerId} onValueChange={value => setNewInvoice({
                ...newInvoice,
                customerId: value
              })}>
                    <SelectTrigger className="touch-button">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => <SelectItem key={customer.id} value={customer.id}>
                          <span className="text-sm">{customer.name} - {customer.company}</span>
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Issue Date *</Label>
                  <Input type="date" value={newInvoice.issueDate} onChange={e => setNewInvoice({
                ...newInvoice,
                issueDate: e.target.value
              })} required className="touch-button" />
                </div>

                <div className="space-y-2">
                  <Label>Due Date *</Label>
                  <Input type="date" value={newInvoice.dueDate} onChange={e => setNewInvoice({
                ...newInvoice,
                dueDate: e.target.value
              })} required className="touch-button" />
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

                {newInvoice.items?.map((item, index) => <Card key={index} className="p-4">
                    <div className="grid grid-cols-5 gap-4 items-end">
                      <div className="space-y-2">
                        <Label>Product/Service</Label>
                        <Select value={item.productId || 'custom'} onValueChange={value => updateInvoiceItem(index, 'productId', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select item or custom" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Custom Item</SelectItem>
                            {getAvailableItemsForCustomer().map(availableItem => {
                        if (availableItem.type === 'separator') {
                          return <div key={availableItem.id} className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">
                                    {availableItem.name}
                                  </div>;
                        }
                        return <SelectItem key={availableItem.id} value={availableItem.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{availableItem.name}</span>
                                    {availableItem.type === 'rental' && <Badge variant="outline" className="text-xs">Rental</Badge>}
                                    <span className="text-muted-foreground text-sm">
                                      ${availableItem.displayPrice.toFixed(2)}
                                      {availableItem.paymentPeriod && <span>/{getPeriodShortLabel(availableItem.paymentPeriod)}</span>}
                                    </span>
                                  </div>
                                </SelectItem>;
                      })}
                          </SelectContent>
                        </Select>
                        {(!item.productId || item.productId === 'custom') && <Input value={item.description} onChange={e => updateInvoiceItem(index, 'description', e.target.value)} placeholder="Custom description" className="mt-2" />}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input type="number" min="1" value={item.quantity} onChange={e => updateInvoiceItem(index, 'quantity', parseInt(e.target.value) || 1)} />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Unit Price</Label>
                        <Input type="number" step="0.01" value={item.unitPrice} onChange={e => updateInvoiceItem(index, 'unitPrice', parseFloat(e.target.value) || 0)} />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Total</Label>
                        <div className="font-bold text-lg">${item.total.toFixed(2)}</div>
                      </div>
                      
                      <div>
                        {(newInvoice.items?.length || 0) > 1 && <Button type="button" variant="destructive" size="sm" onClick={() => removeInvoiceItem(index)}>
                            Remove
                          </Button>}
                      </div>
                    </div>
                  </Card>)}

                {/* Invoice Totals */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4 max-w-md ml-auto">
                    <div className="space-y-2">
                      <Label>Tax Rate (%)</Label>
                      <Input type="number" min="0" max="100" step="0.1" value={newInvoice.taxRate} onChange={e => {
                    const taxRate = parseFloat(e.target.value) || 0;
                    const {
                      subtotal,
                      taxAmount,
                      total
                    } = calculateInvoiceTotals(newInvoice.items || [], taxRate);
                    setNewInvoice({
                      ...newInvoice,
                      taxRate,
                      subtotal,
                      taxAmount,
                      total
                    });
                  }} />
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
                  <Select value={newInvoice.paymentTerms} onValueChange={value => setNewInvoice({
                ...newInvoice,
                paymentTerms: value
              })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={newInvoice.status} onValueChange={(value: Invoice['status']) => setNewInvoice({
                ...newInvoice,
                status: value
              })}>
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
                <Textarea value={newInvoice.notes} onChange={e => setNewInvoice({
              ...newInvoice,
              notes: e.target.value
            })} placeholder="Additional notes or terms..." />
              </div>

              <Button type="submit" className="w-full">
                {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
              </Button>
            </form>
          </CardContent>
        </Card>}

      {/* Filters */}
      <Card className="dashboard-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search invoices..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-64" />
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
          <CardTitle className="text-card-foreground mobile-subheading">Invoices</CardTitle>
          <CardDescription>
            {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No invoices found</p>
            </div> : <div className="mobile-table-scroll">
              <Table className="mobile-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Invoice #</TableHead>
                    <TableHead className="min-w-[150px]">Customer</TableHead>
                    <TableHead className="hide-mobile">Issue Date</TableHead>
                    <TableHead className="hide-mobile">Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right min-w-[80px]">Subtotal</TableHead>
                    <TableHead className="text-right min-w-[80px]">VAT</TableHead>
                    <TableHead className="text-right min-w-[80px]">Total</TableHead>
                    <TableHead className="w-24 md:w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map(invoice => <TableRow key={invoice.id}>
                      <TableCell className="font-medium text-xs md:text-sm">{invoice.invoiceNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                          <span className="text-xs md:text-sm truncate">{invoice.customerName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hide-mobile text-xs">{format(parseISO(invoice.issueDate), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="hide-mobile text-xs">{format(parseISO(invoice.dueDate), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(invoice.status)} text-xs`}>
                          {invoice.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs md:text-sm">${invoice.subtotal.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-xs md:text-sm">${invoice.taxAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold text-xs md:text-sm">${invoice.total.toFixed(2)}</TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => editInvoice(invoice)} className="h-8 w-8 p-0">
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Invoice</TooltipContent>
                            </Tooltip>
                            
                            {invoice.status !== 'paid' && <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="outline" onClick={() => updateInvoiceStatus(invoice.id, 'paid')} className="h-8 w-8 p-0 hover:bg-green-500/10 hover:text-green-600 hover:border-green-600">
                                    <Check className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Mark as Paid</TooltipContent>
                              </Tooltip>}
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => deleteInvoice(invoice.id)} className="hover:bg-destructive hover:text-destructive-foreground h-8 w-8 p-0">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Invoice</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
            </div>}
        </CardContent>
      </Card>

      {/* Sales Log */}
      
    </div>;
}