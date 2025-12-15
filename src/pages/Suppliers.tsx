import { useState } from 'react';
import { Plus, Edit, Trash2, Building2, Search, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useVendors, Vendor } from '@/hooks/useVendors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export default function Suppliers() {
  const { vendors, loading, addVendor, updateVendor, deleteVendor } = useVendors();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [showCreditNoteDialog, setShowCreditNoteDialog] = useState(false);
  const [creditNoteVendor, setCreditNoteVendor] = useState<Vendor | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    contact_person: '',
    payment_terms: '',
    notes: '',
    status: 'active',
    gl_account_number: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingVendor) {
      await updateVendor(editingVendor.id, formData);
      setEditingVendor(null);
    } else {
      await addVendor(formData);
    }
    
    setShowForm(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      contact_person: '',
      payment_terms: '',
      notes: '',
      status: 'active',
      gl_account_number: '',
    });
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      city: vendor.city || '',
      contact_person: vendor.contact_person || '',
      payment_terms: vendor.payment_terms || '',
      notes: vendor.notes || '',
      status: vendor.status,
      gl_account_number: vendor.gl_account_number || '',
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingVendor(null);
    resetForm();
  };

  const handleOpenCreditNote = (vendor: Vendor) => {
    setCreditNoteVendor(vendor);
    setCreditAmount('');
    setCreditReason('');
    setShowCreditNoteDialog(true);
  };

  const handleApplyCreditNote = async () => {
    if (!creditNoteVendor || !creditAmount) return;

    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid credit amount.',
        variant: 'destructive',
      });
      return;
    }

    const currentBalance = creditNoteVendor.credit_balance || 0;
    const newBalance = currentBalance + amount;

    try {
      await updateVendor(creditNoteVendor.id, {
        credit_balance: newBalance,
        notes: creditNoteVendor.notes 
          ? `${creditNoteVendor.notes}\n\nCredit Note (${new Date().toLocaleDateString()}): $${amount.toFixed(2)} - ${creditReason}`
          : `Credit Note (${new Date().toLocaleDateString()}): $${amount.toFixed(2)} - ${creditReason}`,
      });

      toast({
        title: 'Credit note applied',
        description: `$${amount.toFixed(2)} credit added to ${creditNoteVendor.name}. New balance: $${newBalance.toFixed(2)}`,
      });

      setShowCreditNoteDialog(false);
      setCreditNoteVendor(null);
      setCreditAmount('');
      setCreditReason('');
    } catch (error) {
      console.error('Error applying credit note:', error);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');

  const filteredSuppliers = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.gl_account_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Supplier Listing</h1>
          <p className="text-muted-foreground">Manage your suppliers and vendor relationships</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search suppliers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={showForm} onOpenChange={handleCancel}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingVendor ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Supplier Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ABC Supplies Inc."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="supplier@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="New York"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Payment Terms</Label>
                  <Input
                    id="payment_terms"
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    placeholder="Net 30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gl_account_number">GL Account Number</Label>
                  <Input
                    id="gl_account_number"
                    value={formData.gl_account_number}
                    onChange={(e) => setFormData({ ...formData, gl_account_number: e.target.value })}
                    placeholder="2000-001"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit">
                {editingVendor ? 'Update' : 'Add'} Supplier
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Credit Note Dialog */}
      <Dialog open={showCreditNoteDialog} onOpenChange={setShowCreditNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Credit Note</DialogTitle>
            <DialogDescription>
              Add a credit to {creditNoteVendor?.name} that will reduce future bills.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Credit Balance</Label>
              <p className="text-2xl font-bold text-green-600">
                ${(creditNoteVendor?.credit_balance || 0).toFixed(2)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit_amount">Credit Amount *</Label>
              <Input
                id="credit_amount"
                type="number"
                step="0.01"
                min="0.01"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit_reason">Reason</Label>
              <Textarea
                id="credit_reason"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="e.g., Returned goods, price adjustment, overpayment..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreditNoteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyCreditNote} disabled={!creditAmount}>
              Apply Credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="text-center py-8">Loading suppliers...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              All Suppliers ({filteredSuppliers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>GL Account</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Credit Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No suppliers found. Add your first supplier to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">{vendor.name}</TableCell>
                      <TableCell>{vendor.gl_account_number || '-'}</TableCell>
                      <TableCell>{vendor.contact_person || '-'}</TableCell>
                      <TableCell>{vendor.email || '-'}</TableCell>
                      <TableCell>
                        {(vendor.credit_balance || 0) > 0 ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            ${(vendor.credit_balance || 0).toFixed(2)}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={vendor.status === 'active' ? 'default' : 'secondary'}>
                          {vendor.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenCreditNote(vendor)}
                            title="Apply Credit Note"
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(vendor)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteVendor(vendor.id)}
                          >
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