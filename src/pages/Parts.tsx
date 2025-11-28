import { useState } from 'react';
import { useVehicleParts, VehiclePart } from '@/hooks/useVehicleParts';
import { useFleetVehicles } from '@/hooks/useFleetVehicles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Settings, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { format, addMonths, differenceInDays } from 'date-fns';

const Parts = () => {
  const { vehicleParts, loading, addVehiclePart, updateVehiclePart, deleteVehiclePart } = useVehicleParts();
  const { vehicles } = useFleetVehicles();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<VehiclePart | null>(null);

  const [formData, setFormData] = useState({
    vehicle_id: '',
    part_name: '',
    part_category: '',
    installation_date: '',
    lifespan_months: 12,
    cost: '',
    supplier: '',
    status: 'good',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      vehicle_id: '',
      part_name: '',
      part_category: '',
      installation_date: '',
      lifespan_months: 12,
      cost: '',
      supplier: '',
      status: 'good',
      notes: '',
    });
  };

  const handleSubmit = async () => {
    if (!formData.vehicle_id || !formData.part_name || !formData.installation_date) return;

    try {
      const installDate = new Date(formData.installation_date);
      const nextReplacement = addMonths(installDate, formData.lifespan_months);

      await addVehiclePart({
        vehicle_id: formData.vehicle_id,
        part_name: formData.part_name,
        part_category: formData.part_category || null,
        installation_date: formData.installation_date,
        lifespan_months: formData.lifespan_months,
        next_replacement_date: format(nextReplacement, 'yyyy-MM-dd'),
        cost: formData.cost ? parseFloat(formData.cost) : null,
        supplier: formData.supplier || null,
        status: formData.status,
        notes: formData.notes || null,
      });
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating part:', error);
    }
  };

  const handleEdit = (part: VehiclePart) => {
    setEditingPart(part);
    setFormData({
      vehicle_id: part.vehicle_id,
      part_name: part.part_name,
      part_category: part.part_category || '',
      installation_date: part.installation_date,
      lifespan_months: part.lifespan_months,
      cost: part.cost?.toString() || '',
      supplier: part.supplier || '',
      status: part.status,
      notes: part.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingPart) return;

    try {
      const installDate = new Date(formData.installation_date);
      const nextReplacement = addMonths(installDate, formData.lifespan_months);

      await updateVehiclePart(editingPart.id, {
        vehicle_id: formData.vehicle_id,
        part_name: formData.part_name,
        part_category: formData.part_category || null,
        installation_date: formData.installation_date,
        lifespan_months: formData.lifespan_months,
        next_replacement_date: format(nextReplacement, 'yyyy-MM-dd'),
        cost: formData.cost ? parseFloat(formData.cost) : null,
        supplier: formData.supplier || null,
        status: formData.status,
        notes: formData.notes || null,
      });
      setIsEditDialogOpen(false);
      setEditingPart(null);
      resetForm();
    } catch (error) {
      console.error('Error updating part:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      good: { variant: 'default' as const, icon: CheckCircle },
      warning: { variant: 'secondary' as const, icon: Clock },
      needs_replacement: { variant: 'destructive' as const, icon: AlertCircle },
    };
    const config = variants[status as keyof typeof variants] || variants.good;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getDaysUntilReplacement = (nextDate: string) => {
    const days = differenceInDays(new Date(nextDate), new Date());
    if (days < 0) return <span className="text-destructive font-semibold">Overdue by {Math.abs(days)} days</span>;
    if (days <= 30) return <span className="text-yellow-600 font-semibold">Due in {days} days</span>;
    return <span className="text-muted-foreground">{days} days</span>;
  };

  if (loading) return <div className="p-8">Loading parts...</div>;

  const FormFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="vehicle_id">Vehicle *</Label>
        <Select value={formData.vehicle_id} onValueChange={(value) => setFormData({ ...formData, vehicle_id: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select vehicle" />
          </SelectTrigger>
          <SelectContent>
            {vehicles.map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {vehicle.license_plate} - {vehicle.make} {vehicle.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="part_name">Part Name *</Label>
          <Input
            id="part_name"
            value={formData.part_name}
            onChange={(e) => setFormData({ ...formData, part_name: e.target.value })}
            placeholder="e.g., Front Tires"
          />
        </div>
        <div>
          <Label htmlFor="part_category">Category</Label>
          <Input
            id="part_category"
            value={formData.part_category}
            onChange={(e) => setFormData({ ...formData, part_category: e.target.value })}
            placeholder="e.g., Tires, Oil, Brakes"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="installation_date">Installation Date *</Label>
          <Input
            id="installation_date"
            type="date"
            value={formData.installation_date}
            onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="lifespan_months">Lifespan (months) *</Label>
          <Input
            id="lifespan_months"
            type="number"
            min="1"
            value={formData.lifespan_months}
            onChange={(e) => setFormData({ ...formData, lifespan_months: parseInt(e.target.value) || 12 })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cost">Cost ($)</Label>
          <Input
            id="cost"
            type="number"
            step="0.01"
            value={formData.cost}
            onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div>
          <Label htmlFor="supplier">Supplier</Label>
          <Input
            id="supplier"
            value={formData.supplier}
            onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
            placeholder="Supplier name"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="needs_replacement">Needs Replacement</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes..."
        />
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Vehicle Parts & Maintenance</h1>
            <p className="text-muted-foreground mt-1">Track parts with known lifespans and replacement schedules</p>
          </div>
          <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Part
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              All Parts
            </CardTitle>
            <CardDescription>Maintenance items assigned to fleet vehicles</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Part Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Installed</TableHead>
                  <TableHead>Lifespan</TableHead>
                  <TableHead>Next Replacement</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicleParts.map((part) => {
                  const vehicle = vehicles.find(v => v.id === part.vehicle_id);
                  return (
                    <TableRow key={part.id}>
                      <TableCell className="font-medium">
                        {vehicle ? `${vehicle.license_plate}` : 'Unknown Vehicle'}
                        <div className="text-xs text-muted-foreground">
                          {vehicle && `${vehicle.make} ${vehicle.model}`}
                        </div>
                      </TableCell>
                      <TableCell>{part.part_name}</TableCell>
                      <TableCell>
                        {part.part_category && (
                          <Badge variant="outline">{part.part_category}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{format(new Date(part.installation_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{part.lifespan_months} months</TableCell>
                      <TableCell>
                        <div>{format(new Date(part.next_replacement_date), 'MMM dd, yyyy')}</div>
                        <div className="text-xs">{getDaysUntilReplacement(part.next_replacement_date)}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(part.status)}</TableCell>
                      <TableCell>{part.cost ? `$${part.cost.toFixed(2)}` : '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(part)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteVehiclePart(part.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {vehicleParts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No parts added yet. Start tracking maintenance items for your fleet vehicles.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add Part Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Vehicle Part</DialogTitle>
            </DialogHeader>
            <FormFields />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>Add Part</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Part Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Vehicle Part</DialogTitle>
            </DialogHeader>
            <FormFields />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdate}>Update Part</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
};

export default Parts;
