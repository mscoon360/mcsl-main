import { useState, useEffect } from 'react';
import { AlertCircle, DollarSign, Download, Check, Info, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PDFDocument } from 'pdf-lib';
import invoiceTemplate from '@/assets/invoice-template.pdf';
import { cn } from '@/lib/utils';
interface Invoice {
  id: string;
  user_id: string;
  customer_id: string;
  customer_name: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  status: string;
  notes?: string;
  payment_terms?: string;
  created_at?: string;
  updated_at?: string;
}
interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}
export default function AccountsReceivable() {
  const {
    toast
  } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<Record<string, InvoiceItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeName, setChequeName] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDescription, setTransferDescription] = useState('');
  const [transferReference, setTransferReference] = useState('');
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoInvoice, setInfoInvoice] = useState<Invoice | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const fetchInvoices = async () => {
    try {
      const {
        data: invoicesData,
        error: invoicesError
      } = await supabase.from('invoices').select('*').order('due_date', {
        ascending: true
      });
      if (invoicesError) throw invoicesError;
      const {
        data: itemsData,
        error: itemsError
      } = await supabase.from('invoice_items').select('*');
      if (itemsError) throw itemsError;

      // Group items by invoice_id
      const itemsByInvoice: Record<string, InvoiceItem[]> = {};
      itemsData?.forEach(item => {
        if (!itemsByInvoice[item.invoice_id]) {
          itemsByInvoice[item.invoice_id] = [];
        }
        itemsByInvoice[item.invoice_id].push({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total
        });
      });
      setInvoiceItems(itemsByInvoice);
      setInvoices((invoicesData || []) as Invoice[]);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      toast({
        title: 'Error loading invoices',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const downloadInvoicePDF = async (invoice: Invoice) => {
    try {
      const templateBytes = await fetch(invoiceTemplate).then(res => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(templateBytes);
      const form = pdfDoc.getForm();
      const setField = (name: string, value: string) => {
        try {
          form.getTextField(name).setText(value);
        } catch {
          console.log(`${name} field not found`);
        }
      };
      setField('Customer Name', invoice.customer_name);
      setField('Text17', format(new Date(invoice.issue_date), 'dd/MM/yyyy'));
      setField('Text18', invoice.invoice_number);
      const items = invoiceItems[invoice.id] || [];
      for (let i = 0; i < 10; i++) {
        const item = items[i];
        setField(`Item ${i + 1}`, item?.description || '');
        setField(`Amount ${i + 1}`, item ? item.total.toFixed(2) : '');
      }
      setField('Text41', invoice.subtotal.toFixed(2));
      setField('Text42', invoice.tax_amount.toFixed(2));
      setField('Text43', invoice.total.toFixed(2));
      form.flatten();
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], {
        type: 'application/pdf'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice_${invoice.invoice_number}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast({
        title: 'Invoice Downloaded',
        description: `Invoice ${invoice.invoice_number} has been downloaded.`
      });
    } catch (error: any) {
      console.error('Error downloading invoice:', error);
      toast({
        title: 'Download Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };
  const handleRecordPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(invoice.total.toString());
    setPaymentMethod(invoice.payment_terms || '');
    setChequeNumber('');
    setChequeName('');
    setTransferDate('');
    setTransferAmount('');
    setTransferDescription('');
    setTransferReference('');
    setShowPaymentDialog(true);
  };
  const handleViewInfo = (invoice: Invoice) => {
    setInfoInvoice(invoice);
    setShowInfoDialog(true);
  };
  const parsePaymentDetails = (notes: string | null | undefined) => {
    if (!notes) return null;
    try {
      return JSON.parse(notes);
    } catch {
      return null;
    }
  };
  const submitPayment = async () => {
    if (!selectedInvoice) return;
    try {
      const amount = parseFloat(paymentAmount);
      const newStatus = amount >= selectedInvoice.total ? 'paid' : 'partially-paid';
      let paymentDetails: any = {
        payment_method: paymentMethod
      };
      if (paymentMethod === 'Cheque') {
        paymentDetails = {
          ...paymentDetails,
          cheque_number: chequeNumber,
          cheque_name: chequeName
        };
      } else if (paymentMethod === 'Bank Transfer') {
        paymentDetails = {
          ...paymentDetails,
          transfer_date: transferDate,
          transfer_amount: transferAmount,
          transfer_description: transferDescription,
          transfer_reference: transferReference
        };
      }
      const {
        error
      } = await supabase.from('invoices').update({
        status: newStatus,
        notes: JSON.stringify(paymentDetails)
      }).eq('id', selectedInvoice.id);
      if (error) throw error;
      toast({
        title: 'Payment Recorded',
        description: `Payment of $${amount.toFixed(2)} recorded for invoice ${selectedInvoice.invoice_number}.`
      });
      setShowPaymentDialog(false);
      setSelectedInvoice(null);
      setPaymentAmount('');
      setPaymentMethod('');
      setChequeNumber('');
      setChequeName('');
      setTransferDate('');
      setTransferAmount('');
      setTransferDescription('');
      setTransferReference('');
      fetchInvoices();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast({
        title: 'Error recording payment',
        description: error.message,
        variant: 'destructive'
      });
    }
  };
  useEffect(() => {
    fetchInvoices();
    const channel = supabase.channel('invoices-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'invoices'
    }, () => fetchInvoices()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter invoices by date range
  const filteredInvoices = invoices.filter(invoice => {
    const issueDate = new Date(invoice.issue_date);
    if (dateFrom && issueDate < dateFrom) return false;
    if (dateTo && issueDate > dateTo) return false;
    return true;
  });
  const totalOwed = filteredInvoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + i.total, 0);
  const overdueInvoices = filteredInvoices.filter(i => new Date(i.due_date) < new Date() && i.status !== 'paid');
  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      paid: 'default',
      'partially-paid': 'secondary',
      sent: 'outline',
      draft: 'secondary',
      overdue: 'destructive'
    };
    return <Badge variant={variants[status] || 'default'}>{status.replace('-', ' ').toUpperCase()}</Badge>;
  };
  return <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Accounts Receivable</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "MMM dd, yyyy") : "From Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "MMM dd, yyyy") : "To Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>

          {(dateFrom || dateTo) && <Button variant="ghost" onClick={() => {
          setDateFrom(undefined);
          setDateTo(undefined);
        }}>
              Clear Dates
            </Button>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receivable</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalOwed.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Output VAT</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${filteredInvoices.reduce((sum, i) => sum + (i.tax_amount || 0), 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              VAT collected from customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueInvoices.length}</div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input value={selectedInvoice?.invoice_number || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Total Amount</Label>
              <Input value={`$${selectedInvoice?.total.toFixed(2) || '0.00'}`} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Payment Amount *</Label>
              <Input id="paymentAmount" type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === 'Cheque' && <>
                <div className="space-y-2">
                  <Label htmlFor="chequeNumber">Cheque Number *</Label>
                  <Input id="chequeNumber" value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} placeholder="Enter cheque number" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chequeName">Name on Cheque *</Label>
                  <Input id="chequeName" value={chequeName} onChange={e => setChequeName(e.target.value)} placeholder="Enter name on cheque" required />
                </div>
              </>}

            {paymentMethod === 'Bank Transfer' && <>
                <div className="space-y-2">
                  <Label htmlFor="transferDate">Transfer Date *</Label>
                  <Input id="transferDate" type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transferAmount">Transfer Amount *</Label>
                  <Input id="transferAmount" type="number" step="0.01" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0.00" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transferDescription">Description *</Label>
                  <Input id="transferDescription" value={transferDescription} onChange={e => setTransferDescription(e.target.value)} placeholder="Enter description" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transferReference">Reference Number *</Label>
                  <Input id="transferReference" value={transferReference} onChange={e => setTransferReference(e.target.value)} placeholder="Enter reference number" required />
                </div>
              </>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitPayment}>
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Invoice Number</Label>
                <p className="font-medium">{infoInvoice?.invoice_number}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">{infoInvoice && getStatusBadge(infoInvoice.status)}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Customer</Label>
                <p className="font-medium">{infoInvoice?.customer_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Total Amount</Label>
                <p className="font-medium">${infoInvoice?.total.toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Issue Date</Label>
                <p className="font-medium">
                  {infoInvoice && format(new Date(infoInvoice.issue_date), 'MMM dd, yyyy')}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Due Date</Label>
                <p className="font-medium">
                  {infoInvoice && format(new Date(infoInvoice.due_date), 'MMM dd, yyyy')}
                </p>
              </div>
            </div>

            {infoInvoice?.notes && parsePaymentDetails(infoInvoice.notes) && <div className="border-t pt-4 mt-4">
                <Label className="text-lg font-semibold">Payment Details</Label>
                <div className="mt-3 space-y-2">
                  {(() => {
                const details = parsePaymentDetails(infoInvoice.notes);
                if (!details) return null;
                return <>
                        <div>
                          <Label className="text-muted-foreground">Payment Method</Label>
                          <p className="font-medium">{details.payment_method}</p>
                        </div>
                        {details.cheque_number && <>
                            <div>
                              <Label className="text-muted-foreground">Cheque Number</Label>
                              <p className="font-medium">{details.cheque_number}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Name on Cheque</Label>
                              <p className="font-medium">{details.cheque_name}</p>
                            </div>
                          </>}
                        {details.transfer_date && <>
                            <div>
                              <Label className="text-muted-foreground">Transfer Date</Label>
                              <p className="font-medium">{format(new Date(details.transfer_date), 'MMM dd, yyyy')}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Transfer Amount</Label>
                              <p className="font-medium">${parseFloat(details.transfer_amount).toFixed(2)}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Description</Label>
                              <p className="font-medium">{details.transfer_description}</p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Reference Number</Label>
                              <p className="font-medium">{details.transfer_reference}</p>
                            </div>
                          </>}
                      </>;
              })()}
                </div>
              </div>}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInfoDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? <div className="text-center py-8">Loading invoices...</div> : <Card>
          <CardHeader>
            <CardTitle>
              All Invoices ({filteredInvoices.length}
              {dateFrom || dateTo ? ` of ${invoices.length}` : ''})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      {invoices.length === 0 ? 'No invoices found.' : 'No invoices found in selected date range.'}
                    </TableCell>
                  </TableRow> : filteredInvoices.map(invoice => <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.customer_name}</TableCell>
                      <TableCell>{invoice.invoice_number}</TableCell>
                      <TableCell>{format(new Date(invoice.issue_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{format(new Date(invoice.due_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="font-mono text-right">${invoice.subtotal.toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-right">${invoice.tax_amount.toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-right font-bold">${invoice.total.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => downloadInvoicePDF(invoice)} title="Download Invoice">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleViewInfo(invoice)} title="View Details">
                            <Info className="h-4 w-4" />
                          </Button>
                          {invoice.status !== 'paid' && <Button variant="ghost" size="icon" onClick={() => handleRecordPayment(invoice)} title="Record Payment">
                              <Check className="h-4 w-4" />
                            </Button>}
                        </div>
                      </TableCell>
                    </TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>}
    </div>;
}