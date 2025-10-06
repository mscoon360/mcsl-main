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
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
      items: [{ description: '', quantity: 1, unitPrice: 0, total: 0, productId: 'custom' }],
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
        description: product.description || product.name,
        displayPrice: product.price,
        paymentPeriod: null
      });
    });
    
    // Add separator if we have both products and rentals
    if (products.length > 0 && newInvoice.customerId) {
      const customer = customers.find(c => c.id === newInvoice.customerId);
      if (customer) {
        const hasRentals = sales.some(sale => 
          sale.customer === customer.name && 
          sale.items.some(item => item.isRental)
        );
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
        const customerRentals = sales
          .filter(sale => sale.customer === customer.name)
          .flatMap(sale => 
            sale.items
              .filter(item => item.isRental)
              .map(item => {
                // Calculate payment due: monthly price * months in payment period
                const monthsInPeriod = getMonthsInPaymentPeriod(item.paymentPeriod || 'monthly');
                const paymentDue = item.price * monthsInPeriod;
                const periodDisplay = item.paymentPeriod ? `/${getPeriodShortLabel(item.paymentPeriod)}` : '';
                
                return {
                  id: `rental-${sale.id}-${item.product}`,
                  name: `${item.product} (Rental)`,
                  price: paymentDue, // Use the calculated payment due amount
                  type: 'rental',
                  description: `Rental service for ${item.product}`,
                  contractLength: item.contractLength,
                  paymentPeriod: item.paymentPeriod,
                  displayPrice: paymentDue,
                  originalPrice: item.price
                };
              })
          );
        
        availableItems.push(...customerRentals);
      }
    }
    
    return availableItems;
  };

  // Helper functions for payment period calculations
  const getMonthsInPaymentPeriod = (period: string) => {
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
    const updatedItems = [...(newInvoice.items || []), { description: '', quantity: 1, unitPrice: 0, total: 0, productId: 'custom' }];
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

  const generateInvoicePDF = (invoice: Invoice) => {
    try {
      const doc = new jsPDF();
      
      // Add logo at top left
      const logoImg = new Image();
      logoImg.src = '/src/assets/magic-care-logo.png';
      logoImg.onload = () => {
        doc.addImage(logoImg, 'PNG', 15, 10, 30, 30);
      };
      
      // Company Name
      doc.setFontSize(18);
      doc.setTextColor(0, 102, 204);
      doc.setFont(undefined, 'bold');
      doc.text('MAGIC-CARE SOLUTIONS LIMITED', 105, 20, { align: 'center' });
      
      // TAX INVOICE
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('TAX INVOICE', 105, 30, { align: 'center' });
      
      // Tagline
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.setFont(undefined, 'italic');
      doc.text('"Caring for your Health"', 105, 37, { align: 'center' });
      
      // VAT Registration
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text('VAT REG. No. 317089', 105, 43, { align: 'center' });
      
      // Invoice details - right side
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(`Invoice Date: ${format(parseISO(invoice.issueDate), 'MM/dd/yyyy')}`, 140, 55);
      doc.text(`Invoice Number: ${invoice.invoiceNumber}`, 140, 62);
      
      // Customer details - left side
      const customer = customers.find(c => c.id === invoice.customerId);
      let yPos = 55;
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(invoice.customerName, 20, yPos);
      
      if (customer) {
        yPos += 7;
        if (customer.address) {
          doc.text(customer.address, 20, yPos);
          yPos += 7;
        }
        if (customer.city) {
          doc.text(customer.city, 20, yPos);
          yPos += 7;
        }
      }
      
      // Services Division Menu (Column 1 - Fixed content)
      const servicesMenu = [
        'SOLUTIONS Division - I',
        'i-giene care SOLUTIONS',
        'Fem-Care Units',
        'Nappy-Care Units',
        'washroom care SOLUTIONS',
        'Magic AeroWest Units',
        'Hand-Care Units',
        'Air-Care Units',
        'Toilet Seat Sani-Care Units',
        'Urinal Care',
        'Paper Dispensers',
        'Infant Care',
        'healthcare SOLUTIONS',
        'Clinical Waste Units',
        'Medical Waste Units',
        'Dental Waste Units',
        'ACE PEST MANAGEMENT',
        'SOLUTIONS Division - II',
        'Rodent Control',
        'Insect Control',
        'Bird Control',
        'Bed Bugs',
        'Pest Prevention & Management',
        'Wildlife Management',
        'Global Eco-Products SOLUTIONS',
        'Division - III',
        'Eco-Paper Products',
        'SCENT: LINQ:',
        'Corporate Scenting System',
        'Ambient Scenting System',
        'Microfiber Cleaning System',
        'Janitorial Products',
        'Dust Control Mats'
      ];
      
      // Create table data with 3 columns
      const tableStartY = 85;
      const maxRows = Math.max(servicesMenu.length, invoice.items.length);
      const tableData = [];
      
      for (let i = 0; i < maxRows; i++) {
        tableData.push([
          servicesMenu[i] || '',
          invoice.items[i]?.description || '',
          invoice.items[i] ? `TTD$ ${invoice.items[i].total.toFixed(2)}` : ''
        ]);
      }
      
      autoTable(doc, {
        startY: tableStartY,
        head: [['', 'DESCRIPTION', 'AMOUNT']],
        body: tableData,
        theme: 'plain',
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: 0,
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'left',
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        bodyStyles: {
          fontSize: 8,
          textColor: 60,
          cellPadding: 2,
          lineWidth: 0.1,
          lineColor: [200, 200, 200]
        },
        columnStyles: {
          0: { cellWidth: 50, halign: 'left', fontSize: 7 },
          1: { cellWidth: 95, halign: 'left' },
          2: { cellWidth: 40, halign: 'right' }
        },
        margin: { left: 15, right: 15 },
        styles: {
          lineColor: [0, 0, 0],
          lineWidth: 0.1
        }
      });
      
      // Calculate totals position
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      
      // Company Name Footer
      doc.setFontSize(10);
      doc.setTextColor(0, 102, 204);
      doc.setFont(undefined, 'bold');
      doc.text('MAGIC-CARE SOLUTIONS LIMITED', 20, finalY);
      
      // Thank You
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Thank You!', 20, finalY + 10);
      
      // Totals section - right aligned
      const totalsX = 140;
      const valuesX = 190;
      
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text('SUB-TOTAL:', totalsX, finalY);
      doc.text(`TTD$ ${invoice.subtotal.toFixed(2)}`, valuesX, finalY, { align: 'right' });
      
      doc.text('VAT:', totalsX, finalY + 7);
      doc.text(`TTD$ ${invoice.taxAmount.toFixed(2)}`, valuesX, finalY + 7, { align: 'right' });
      
      doc.setFont(undefined, 'bold');
      doc.text('TOTAL TTD$:', totalsX, finalY + 14);
      doc.text(`TTD$ ${invoice.total.toFixed(2)}`, valuesX, finalY + 14, { align: 'right' });
      
      // Authorized Signature
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.text('AUTHORIZED SIGNATURE', totalsX, finalY + 25);
      doc.line(totalsX, finalY + 28, valuesX, finalY + 28);
      
      // Footer section
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('A member of GROUP of Companies', 105, pageHeight - 45, { align: 'center' });
      
      doc.setFontSize(8);
      doc.text('Please make cheques payable to: MAGIC-CARE SOLUTIONS LIMITED', 20, pageHeight - 35);
      doc.text('Corner Stone & Duke Streets, West, Port of Spain,', 20, pageHeight - 30);
      doc.text('Tel: (868) 627-7717, 623-9863', 20, pageHeight - 25);
      doc.text('Fax: (868)627-3897', 20, pageHeight - 20);
      doc.text('Mobile: (868)342-3386', 20, pageHeight - 15);
      doc.text('Email: magiccaresolutions@mmsl.co', 20, pageHeight - 10);
      doc.text('Email: magiccaresolutions@gmail.com', 100, pageHeight - 10);
      
      // Save the PDF
      doc.save(`Invoice_${invoice.invoiceNumber}.pdf`);
      
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
        description: `Invoice ${invoice.invoiceNumber} has been created and PDF downloaded.`
      });
      
      // Generate and download PDF for new invoices
      generateInvoicePDF(invoice);
    }

    resetForm();
  };

  const resetForm = () => {
    setNewInvoice({
      customerId: '',
      issueDate: format(new Date(), 'yyyy-MM-dd'),
      dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      status: 'draft',
      items: [{ description: '', quantity: 1, unitPrice: 0, total: 0, productId: 'custom' }],
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
              {totalInvoices > 0 ? ((paidInvoices / totalInvoices) * 100).toFixed(1) : '0'}% of total
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
              <div className="mobile-form-grid">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select 
                    value={newInvoice.customerId} 
                    onValueChange={(value) => setNewInvoice({...newInvoice, customerId: value})}
                  >
                    <SelectTrigger className="touch-button">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          <span className="text-sm">{customer.name} - {customer.company}</span>
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
                    className="touch-button"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Due Date *</Label>
                  <Input
                    type="date"
                    value={newInvoice.dueDate}
                    onChange={(e) => setNewInvoice({...newInvoice, dueDate: e.target.value})}
                    required
                    className="touch-button"
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
                          value={item.productId || 'custom'}
                          onValueChange={(value) => updateInvoiceItem(index, 'productId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select item or custom" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Custom Item</SelectItem>
                            {getAvailableItemsForCustomer().map(availableItem => {
                              if (availableItem.type === 'separator') {
                                return (
                                  <div key={availableItem.id} className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">
                                    {availableItem.name}
                                  </div>
                                );
                              }
                              
                              return (
                                <SelectItem key={availableItem.id} value={availableItem.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{availableItem.name}</span>
                                    {availableItem.type === 'rental' && (
                                      <Badge variant="outline" className="text-xs">Rental</Badge>
                                    )}
                                    <span className="text-muted-foreground text-sm">
                                      ${availableItem.displayPrice.toFixed(2)}
                                      {availableItem.paymentPeriod && (
                                        <span>/{getPeriodShortLabel(availableItem.paymentPeriod)}</span>
                                      )}
                                    </span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        {(!item.productId || item.productId === 'custom') && (
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
          <CardTitle className="text-card-foreground mobile-subheading">Invoices</CardTitle>
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
            <div className="mobile-table-scroll">
              <Table className="mobile-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Invoice #</TableHead>
                    <TableHead className="min-w-[150px]">Customer</TableHead>
                    <TableHead className="hide-mobile">Issue Date</TableHead>
                    <TableHead className="hide-mobile">Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right min-w-[80px]">Total</TableHead>
                    <TableHead className="w-24 md:w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
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
                      <TableCell className="text-right font-bold text-xs md:text-sm">${invoice.total.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => editInvoice(invoice)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          {invoice.status !== 'paid' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateInvoiceStatus(invoice.id, 'paid')}
                              className="h-8 w-8 p-0"
                            >
                              <DollarSign className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteInvoice(invoice.id)}
                            className="hover:bg-destructive hover:text-destructive-foreground h-8 w-8 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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