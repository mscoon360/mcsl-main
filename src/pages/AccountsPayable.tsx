import { useState } from 'react';
import { Plus, Edit, Trash2, AlertCircle, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccountsPayable, AccountPayable } from '@/hooks/useAccountsPayable';
import { useVendors } from '@/hooks/useVendors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';

export default function AccountsPayable() {
  const { bills, loading, addBill, updateBill, deleteBill } = useAccountsPayable();
  const { vendors } = useVendors();
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState<AccountPayable | null>(null);
  const [formData, setFormData] = useState({
    vendor_id: '',
    vendor_name: '',
    bill_number: '',
    bill_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(new Date(), 'yyyy-MM-dd'),
    subtotal: '',
    vat_amount: '',
    amount: '',
    description: '',
    status: 'unpaid',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const subtotal = parseFloat(formData.subtotal) || 0;
    const vatAmount = parseFloat(formData.vat_amount) || 0;
    const total = subtotal + vatAmount;
    
    const billData = {
      ...formData,
      subtotal,
      vat_amount: vatAmount,
      amount: total,
    };
    
    if (editingBill) {
      await updateBill(editingBill.id, billData);
      setEditingBill(null);
    } else {
      await addBill(billData);
    }
    
    setShowForm(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      vendor_id: '',
      vendor_name: '',
      bill_number: '',
      bill_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: format(new Date(), 'yyyy-MM-dd'),
      subtotal: '',
      vat_amount: '',
      amount: '',
      description: '',
      status: 'unpaid',
    });
  };

  const handleEdit = (bill: AccountPayable) => {
    setEditingBill(bill);
    setFormData({
      vendor_id: bill.vendor_id || '',
      vendor_name: bill.vendor_name,
      bill_number: bill.bill_number,
      bill_date: bill.bill_date,
      due_date: bill.due_date,
      subtotal: (bill.subtotal || 0).toString(),
      vat_amount: (bill.vat_amount || 0).toString(),
      amount: bill.amount.toString(),
      description: bill.description || '',
      status: bill.status,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingBill(null);
    resetForm();
  };

  const handleVendorChange = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    setFormData({
      ...formData,
      vendor_id: vendorId,
      vendor_name: vendor?.name || '',
    });
  };

  const totalOwed = bills.filter(b => b.status !== 'paid').reduce((sum, b) => sum + (b.amount - b.amount_paid), 0);
  const overdueBills = bills.filter(b => new Date(b.due_date) < new Date() && b.status !== 'paid');

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      paid: 'default',
      'partially-paid': 'secondary',
      unpaid: 'destructive',
      overdue: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status.replace('-', ' ').toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Accounts Payable</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Bill
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Owed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalOwed.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Bills</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueBills.length}</div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showForm} onOpenChange={handleCancel}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingBill ? 'Edit Bill' : 'Add New Bill'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vendor">Vendor *</Label>
                  <Select value={formData.vendor_id} onValueChange={handleVendorChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bill_number">Bill Number *</Label>
                  <Input
                    id="bill_number"
                    value={formData.bill_number}
                    onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
                    placeholder="INV-001"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bill_date">Bill Date *</Label>
                  <Input
                    id="bill_date"
                    type="date"
                    value={formData.bill_date}
                    onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subtotal">Subtotal *</Label>
                  <Input
                    id="subtotal"
                    type="number"
                    step="0.01"
                    value={formData.subtotal}
                    onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat_amount">Input VAT (12.5%)</Label>
                  <Input
                    id="vat_amount"
                    type="number"
                    step="0.01"
                    value={formData.vat_amount}
                    onChange={(e) => setFormData({ ...formData, vat_amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total">Total</Label>
                  <Input
                    id="total"
                    type="number"
                    step="0.01"
                    value={(parseFloat(formData.subtotal || '0') + parseFloat(formData.vat_amount || '0')).toFixed(2)}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Bill description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="partially-paid">Partially Paid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit">
                {editingBill ? 'Update' : 'Add'} Bill
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="text-center py-8">Loading bills...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Bills ({bills.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Bill Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Input VAT</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      No bills found. Add your first bill to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  bills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">{bill.vendor_name}</TableCell>
                      <TableCell>{bill.bill_number}</TableCell>
                      <TableCell>{format(new Date(bill.bill_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{format(new Date(bill.due_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="font-mono text-right">${(bill.subtotal || 0).toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-right">${(bill.vat_amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-right font-bold">${bill.amount.toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-right">${(bill.amount - bill.amount_paid).toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(bill.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(bill)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteBill(bill.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
