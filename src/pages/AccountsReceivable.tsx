import { useState, useEffect } from 'react';
import { AlertCircle, DollarSign, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PDFDocument } from 'pdf-lib';
import invoiceTemplate from '@/assets/invoice-template.pdf';

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
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<Record<string, InvoiceItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  const fetchInvoices = async () => {
    try {
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .order('due_date', { ascending: true });

      if (invoicesError) throw invoicesError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*');

      if (itemsError) throw itemsError;

      // Group items by invoice_id
      const itemsByInvoice: Record<string, InvoiceItem[]> = {};
      itemsData?.forEach((item) => {
        if (!itemsByInvoice[item.invoice_id]) {
          itemsByInvoice[item.invoice_id] = [];
        }
        itemsByInvoice[item.invoice_id].push({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
        });
      });

      setInvoiceItems(itemsByInvoice);
      setInvoices((invoicesData || []) as Invoice[]);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      toast({
        title: 'Error loading invoices',
        description: error.message,
        variant: 'destructive',
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
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice_${invoice.invoice_number}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Invoice Downloaded',
        description: `Invoice ${invoice.invoice_number} has been downloaded.`,
      });
    } catch (error: any) {
      console.error('Error downloading invoice:', error);
      toast({
        title: 'Download Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRecordPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(invoice.total.toString());
    setShowPaymentDialog(true);
  };

  const submitPayment = async () => {
    if (!selectedInvoice) return;

    try {
      const amount = parseFloat(paymentAmount);
      const newStatus = amount >= selectedInvoice.total ? 'paid' : 'partially-paid';

      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      toast({
        title: 'Payment Recorded',
        description: `Payment of $${amount.toFixed(2)} recorded for invoice ${selectedInvoice.invoice_number}.`,
      });

      setShowPaymentDialog(false);
      setSelectedInvoice(null);
      setPaymentAmount('');
      fetchInvoices();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast({
        title: 'Error recording payment',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchInvoices();

    const channel = supabase
      .channel('invoices-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        () => fetchInvoices()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const totalOwed = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + i.total, 0);
  const overdueInvoices = invoices.filter(i => new Date(i.due_date) < new Date() && i.status !== 'paid');

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      paid: 'default',
      'partially-paid': 'secondary',
      sent: 'outline',
      draft: 'secondary',
      overdue: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status.replace('-', ' ').toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Accounts Receivable</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
            <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueInvoices.length}</div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
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
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
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

      {loading ? (
        <div className="text-center py-8">Loading invoices...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Invoices ({invoices.length})</CardTitle>
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
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No invoices found.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
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
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => downloadInvoicePDF(invoice)}
                            title="Download Invoice"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {invoice.status !== 'paid' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleRecordPayment(invoice)}
                              title="Record Payment"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
