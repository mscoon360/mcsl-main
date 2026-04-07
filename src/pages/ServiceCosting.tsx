import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Edit, Trash2, Calculator, DollarSign, TrendingUp } from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { useServiceCostings, ServiceCosting as ServiceCostingType } from "@/hooks/useServiceCostings";

const PAYMENT_TERMS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-monthly', label: 'Bi-Monthly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

export default function ServiceCostingPage() {
  const { services } = useServices();
  const { costings, loading, addCosting, updateCosting, deleteCosting, getCostingsForService } = useServiceCostings();

  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCosting, setEditingCosting] = useState<ServiceCostingType | null>(null);

  const [form, setForm] = useState({
    payment_term: 'monthly',
    rental_price: 0,
    unit_cost: 0,
    refill_cost: 0,
    battery_cost: 0,
    battery_frequency_months: 12,
    indirect_cost_percentage: 12.5,
    margin_percentage: 0,
    notes: '',
  });

  const selectedService = useMemo(() =>
    services.find(s => s.id === selectedServiceId),
    [services, selectedServiceId]
  );

  const serviceCostings = useMemo(() =>
    selectedServiceId ? getCostingsForService(selectedServiceId) : [],
    [selectedServiceId, costings]
  );

  const calculateTotals = (data: typeof form) => {
    const unitCost = Number(data.unit_cost) || 0;
    const refillCost = Number(data.refill_cost) || 0;
    const batteryCost = Number(data.battery_cost) || 0;
    const batteryFreq = Number(data.battery_frequency_months) || 12;
    const indirectPct = Number(data.indirect_cost_percentage) || 0;

    const annualBatteryCost = batteryCost * (12 / batteryFreq);
    const totalDirectCosts = unitCost + refillCost + annualBatteryCost;
    const indirectCosts = totalDirectCosts * (indirectPct / 100);
    const totalCost = totalDirectCosts + indirectCosts;
    const rentalPrice = Number(data.rental_price) || 0;
    const margin = rentalPrice > 0 ? ((rentalPrice - totalCost) / rentalPrice) * 100 : 0;

    return { totalDirectCosts, indirectCosts, totalCost, margin };
  };

  const handleAdd = async () => {
    if (!selectedServiceId) return;
    const totals = calculateTotals(form);
    await addCosting({
      service_id: selectedServiceId,
      payment_term: form.payment_term,
      rental_price: form.rental_price,
      unit_cost: form.unit_cost,
      refill_cost: form.refill_cost,
      battery_cost: form.battery_cost,
      battery_frequency_months: form.battery_frequency_months,
      indirect_cost_percentage: form.indirect_cost_percentage,
      margin_percentage: totals.margin,
      total_direct_costs: totals.totalDirectCosts,
      total_cost: totals.totalCost,
      notes: form.notes,
    });
    setIsAddDialogOpen(false);
    resetForm();
  };

  const handleUpdate = async () => {
    if (!editingCosting) return;
    const totals = calculateTotals(form);
    await updateCosting(editingCosting.id, {
      payment_term: form.payment_term,
      rental_price: form.rental_price,
      unit_cost: form.unit_cost,
      refill_cost: form.refill_cost,
      battery_cost: form.battery_cost,
      battery_frequency_months: form.battery_frequency_months,
      indirect_cost_percentage: form.indirect_cost_percentage,
      margin_percentage: totals.margin,
      total_direct_costs: totals.totalDirectCosts,
      total_cost: totals.totalCost,
      notes: form.notes,
    });
    setIsEditDialogOpen(false);
    setEditingCosting(null);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this costing record?')) {
      await deleteCosting(id);
    }
  };

  const openEdit = (costing: ServiceCostingType) => {
    setEditingCosting(costing);
    setForm({
      payment_term: costing.payment_term,
      rental_price: costing.rental_price,
      unit_cost: costing.unit_cost || 0,
      refill_cost: costing.refill_cost || 0,
      battery_cost: costing.battery_cost || 0,
      battery_frequency_months: costing.battery_frequency_months || 12,
      indirect_cost_percentage: costing.indirect_cost_percentage || 12.5,
      margin_percentage: costing.margin_percentage || 0,
      notes: costing.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setForm({
      payment_term: 'monthly',
      rental_price: 0,
      unit_cost: 0,
      refill_cost: 0,
      battery_cost: 0,
      battery_frequency_months: 12,
      indirect_cost_percentage: 12.5,
      margin_percentage: 0,
      notes: '',
    });
  };

  const currentTotals = calculateTotals(form);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Service Costing</h1>
          <p className="text-muted-foreground">Manage cost breakdowns for your services</p>
        </div>
      </div>

      {/* Service Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Select Service
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service..." />
                </SelectTrigger>
                <SelectContent>
                  {services.map(service => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} - ${service.price || 0}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedServiceId && (
              <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Costing
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Costings Table */}
      {selectedServiceId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Breakdown - {selectedService?.name}
            </CardTitle>
            <CardDescription>
              {serviceCostings.length} costing record(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {serviceCostings.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No costing records yet. Click "Add Costing" to create one.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Term</TableHead>
                    <TableHead>Service Price</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Total Direct</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Margin</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceCostings.map(costing => {
                    const margin = costing.margin_percentage || 0;
                    return (
                      <TableRow key={costing.id}>
                        <TableCell>
                          <Badge variant="outline">{costing.payment_term}</Badge>
                        </TableCell>
                        <TableCell>${(costing.rental_price || 0).toFixed(2)}</TableCell>
                        <TableCell>${(costing.unit_cost || 0).toFixed(2)}</TableCell>
                        <TableCell>${(costing.total_direct_costs || 0).toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">${(costing.total_cost || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={margin >= 20 ? 'default' : margin >= 0 ? 'secondary' : 'destructive'}>
                            {margin.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(costing)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(costing.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      {[
        { open: isAddDialogOpen, setOpen: setIsAddDialogOpen, title: 'Add Service Costing', onSubmit: handleAdd },
        { open: isEditDialogOpen, setOpen: setIsEditDialogOpen, title: 'Edit Service Costing', onSubmit: handleUpdate },
      ].map(({ open, setOpen, title, onSubmit }) => (
        <Dialog key={title} open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Payment Term</Label>
                <Select value={form.payment_term} onValueChange={v => setForm(p => ({ ...p, payment_term: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Service Price</Label>
                  <Input type="number" step="0.01" value={form.rental_price}
                    onChange={e => setForm(p => ({ ...p, rental_price: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Unit Cost</Label>
                  <Input type="number" step="0.01" value={form.unit_cost}
                    onChange={e => setForm(p => ({ ...p, unit_cost: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Refill Cost</Label>
                  <Input type="number" step="0.01" value={form.refill_cost}
                    onChange={e => setForm(p => ({ ...p, refill_cost: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Battery Cost</Label>
                  <Input type="number" step="0.01" value={form.battery_cost}
                    onChange={e => setForm(p => ({ ...p, battery_cost: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Battery Freq (months)</Label>
                  <Input type="number" value={form.battery_frequency_months}
                    onChange={e => setForm(p => ({ ...p, battery_frequency_months: parseInt(e.target.value) || 12 }))} />
                </div>
                <div>
                  <Label>Indirect Cost %</Label>
                  <Input type="number" step="0.1" value={form.indirect_cost_percentage}
                    onChange={e => setForm(p => ({ ...p, indirect_cost_percentage: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>

              <Separator />
              <div className="space-y-2 text-sm bg-muted/50 p-3 rounded-lg">
                <div className="flex justify-between">
                  <span>Total Direct Costs:</span>
                  <span className="font-medium">${currentTotals.totalDirectCosts.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>+ Indirect Costs:</span>
                  <span className="font-medium">${currentTotals.indirectCosts.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total Cost:</span>
                  <span>${currentTotals.totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Margin:</span>
                  <Badge variant={currentTotals.margin >= 20 ? 'default' : currentTotals.margin >= 0 ? 'secondary' : 'destructive'}>
                    {currentTotals.margin.toFixed(1)}%
                  </Badge>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={onSubmit}>{title.startsWith('Add') ? 'Add' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
