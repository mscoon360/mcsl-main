import { useState, useEffect, Fragment } from 'react';
import { useServices, Service } from '@/hooks/useServices';
import { useDivisions } from '@/hooks/useDivisions';
import { useVendors } from '@/hooks/useVendors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus, Info, ChevronDown, ChevronRight, Briefcase } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Services() {
  const { services, loading, addService, updateService, deleteService } = useServices();
  const { divisions } = useDivisions();
  const { vendors: suppliers } = useVendors();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [serviceType, setServiceType] = useState<'sale_only' | 'rental_only' | 'both'>('sale_only');
  const [needsServicing, setNeedsServicing] = useState(false);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('');
  const [selectedSubdivisionId, setSelectedSubdivisionId] = useState<string>('');
  const [editDivisionId, setEditDivisionId] = useState<string>('');
  const [editSubdivisionId, setEditSubdivisionId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [editSelectedSupplierId, setEditSelectedSupplierId] = useState<string>('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [initialCategoriesSet, setInitialCategoriesSet] = useState(false);

  useEffect(() => {
    if (!initialCategoriesSet && services.length > 0) {
      const allCategories = new Set<string>();
      services.forEach(s => allCategories.add(s.category || 'Uncategorized'));
      setCollapsedCategories(allCategories);
      setInitialCategoriesSet(true);
    }
  }, [services, initialCategoriesSet]);

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) newSet.delete(category);
      else newSet.add(category);
      return newSet;
    });
  };

  const groupByCategory = (list: Service[]) => {
    const groups: Record<string, Service[]> = {};
    list.forEach(s => {
      const cat = s.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return Object.keys(groups).sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    }).map(category => ({ category, services: groups[category] }));
  };

  const getDivisionName = (divisionId?: string) => {
    if (!divisionId) return '';
    const division = divisions.find(d => d.id === divisionId);
    return division?.name || '';
  };

  const handleAddService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const name = formData.get('name') as string;
    const sku = (formData.get('sku') as string) || `SVC-${Date.now()}`;
    const description = formData.get('description') as string;
    const supplier_name = suppliers.find(s => s.id === selectedSupplierId)?.name || '';
    const cost_price = parseFloat(formData.get('cost_price') as string) || 0;
    const service_frequency = formData.get('service_frequency') as string;

    const newService: Omit<Service, 'id'> = {
      name,
      sku,
      description,
      price: 0,
      rental_price: serviceType !== 'sale_only' ? 0 : undefined,
      division_id: selectedDivisionId || undefined,
      subdivision_id: selectedSubdivisionId || undefined,
      status: 'active',
      is_rental: serviceType !== 'sale_only',
      is_rental_only: serviceType === 'rental_only',
      supplier_name,
      cost_price,
      needs_servicing: serviceType !== 'sale_only' && needsServicing,
      service_frequency,
      category: formData.get('category') as string || undefined,
    };

    try {
      await addService(newService);
      setIsAddDialogOpen(false);
      form.reset();
      setServiceType('sale_only');
      setNeedsServicing(false);
      setSelectedDivisionId('');
      setSelectedSubdivisionId('');
      setSelectedSupplierId('');
    } catch (error) {}
  };

  const handleEditService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const updates: Partial<Service> = {
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      description: formData.get('description') as string,
      division_id: editDivisionId || undefined,
      subdivision_id: editSubdivisionId || undefined,
      price: parseFloat(formData.get('price') as string) || 0,
      cost_price: parseFloat(formData.get('cost_price') as string) || 0,
      supplier_name: suppliers.find(s => s.id === editSelectedSupplierId)?.name || editingService?.supplier_name,
      category: formData.get('category') as string || undefined,
      service_frequency: formData.get('service_frequency') as string || undefined,
    };

    try {
      await updateService(editingService.id, updates);
      setIsEditDialogOpen(false);
      setEditingService(null);
    } catch (error) {}
  };

  const handleDeleteService = async (id: string) => {
    if (confirm('Are you sure you want to delete this service?')) {
      try {
        await deleteService(id);
      } catch (error) {}
    }
  };

  const openEditDialog = (service: any) => {
    setEditingService(service);
    setEditDivisionId(service.division_id || '');
    setEditSubdivisionId(service.subdivision_id || '');
    setEditSelectedSupplierId('');
    setIsEditDialogOpen(true);
  };

  const selectedDivision = divisions.find(d => d.id === selectedDivisionId);
  const editDivision = divisions.find(d => d.id === editDivisionId);

  if (loading) return <div className="p-6">Loading services...</div>;

  const categorizedServices = groupByCategory(services);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Services</h1>
          <p className="text-muted-foreground">Manage your service offerings</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Service
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {services.filter(s => s.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rental Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {services.filter(s => s.is_rental).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Needs Servicing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {services.filter(s => s.needs_servicing).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorizedServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No services found. Add your first service to get started.
                  </TableCell>
                </TableRow>
              ) : (
                categorizedServices.map(group => (
                  <Fragment key={group.category}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50 bg-muted/30"
                      onClick={() => toggleCategory(group.category)}
                    >
                      <TableCell>
                        {collapsedCategories.has(group.category)
                          ? <ChevronRight className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />}
                      </TableCell>
                      <TableCell colSpan={8} className="font-semibold">
                        {group.category} ({group.services.length})
                      </TableCell>
                    </TableRow>
                    {!collapsedCategories.has(group.category) && group.services.map(service => (
                      <TableRow key={service.id}>
                        <TableCell></TableCell>
                        <TableCell className="font-medium">{service.name}</TableCell>
                        <TableCell className="text-muted-foreground">{service.sku}</TableCell>
                        <TableCell>{getDivisionName(service.division_id)}</TableCell>
                        <TableCell>${(service.price || 0).toFixed(2)}</TableCell>
                        <TableCell>${(service.cost_price || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          {service.is_rental_only ? (
                            <Badge variant="secondary">Rental Only</Badge>
                          ) : service.is_rental ? (
                            <Badge variant="outline">Sale & Rental</Badge>
                          ) : (
                            <Badge>Sale</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={service.status === 'active' ? 'default' : 'secondary'}>
                            {service.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => {
                              setSelectedService(service);
                              setIsDetailsDialogOpen(true);
                            }}>
                              <Info className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(service)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteService(service.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Service Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Service</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddService} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Service Name *</Label>
                <Input id="name" name="name" required />
              </div>
              <div>
                <Label htmlFor="sku">SKU (auto-generated if blank)</Label>
                <Input id="sku" name="sku" placeholder="SVC-..." />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" placeholder="e.g., Cleaning, Maintenance" />
              </div>
              <div>
                <Label htmlFor="cost_price">Cost Price</Label>
                <Input id="cost_price" name="cost_price" type="number" step="0.01" defaultValue="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Division</Label>
                <Select value={selectedDivisionId} onValueChange={setSelectedDivisionId}>
                  <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
                  <SelectContent>
                    {divisions.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subdivision</Label>
                <Select value={selectedSubdivisionId} onValueChange={setSelectedSubdivisionId}>
                  <SelectTrigger><SelectValue placeholder="Select subdivision" /></SelectTrigger>
                  <SelectContent>
                    {(selectedDivision?.subdivisions || []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Supplier</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="service_frequency">Service Frequency</Label>
                <Input id="service_frequency" name="service_frequency" placeholder="e.g., Weekly, Monthly" />
              </div>
            </div>

            <Separator />
            <div>
              <Label>Service Type</Label>
              <RadioGroup value={serviceType} onValueChange={(v: any) => setServiceType(v)} className="flex gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sale_only" id="sale_only" />
                  <Label htmlFor="sale_only">Sale Only</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="rental_only" id="rental_only" />
                  <Label htmlFor="rental_only">Rental Only</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="both" id="both" />
                  <Label htmlFor="both">Both</Label>
                </div>
              </RadioGroup>
            </div>

            {serviceType !== 'sale_only' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="needs_servicing"
                  checked={needsServicing}
                  onCheckedChange={(v) => setNeedsServicing(!!v)}
                />
                <Label htmlFor="needs_servicing">Needs Regular Servicing</Label>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Add Service</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Service Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
          </DialogHeader>
          {editingService && (
            <form onSubmit={handleEditService} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Service Name *</Label>
                  <Input id="edit-name" name="name" defaultValue={editingService.name} required />
                </div>
                <div>
                  <Label htmlFor="edit-sku">SKU</Label>
                  <Input id="edit-sku" name="sku" defaultValue={editingService.sku} />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea id="edit-description" name="description" defaultValue={editingService.description} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-category">Category</Label>
                  <Input id="edit-category" name="category" defaultValue={editingService.category} />
                </div>
                <div>
                  <Label htmlFor="edit-price">Price</Label>
                  <Input id="edit-price" name="price" type="number" step="0.01" defaultValue={editingService.price} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-cost_price">Cost Price</Label>
                  <Input id="edit-cost_price" name="cost_price" type="number" step="0.01" defaultValue={editingService.cost_price} />
                </div>
                <div>
                  <Label htmlFor="edit-service_frequency">Service Frequency</Label>
                  <Input id="edit-service_frequency" name="service_frequency" defaultValue={editingService.service_frequency} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Division</Label>
                  <Select value={editDivisionId} onValueChange={setEditDivisionId}>
                    <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
                    <SelectContent>
                      {divisions.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subdivision</Label>
                  <Select value={editSubdivisionId} onValueChange={setEditSubdivisionId}>
                    <SelectTrigger><SelectValue placeholder="Select subdivision" /></SelectTrigger>
                    <SelectContent>
                      {(editDivision?.subdivisions || []).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Service Details</DialogTitle>
          </DialogHeader>
          {selectedService && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{selectedService.name}</span>
                <span className="text-muted-foreground">SKU:</span>
                <span>{selectedService.sku}</span>
                <span className="text-muted-foreground">Category:</span>
                <span>{selectedService.category || 'N/A'}</span>
                <span className="text-muted-foreground">Price:</span>
                <span>${(selectedService.price || 0).toFixed(2)}</span>
                <span className="text-muted-foreground">Cost Price:</span>
                <span>${(selectedService.cost_price || 0).toFixed(2)}</span>
                <span className="text-muted-foreground">Division:</span>
                <span>{getDivisionName(selectedService.division_id) || 'N/A'}</span>
                <span className="text-muted-foreground">Supplier:</span>
                <span>{selectedService.supplier_name || 'N/A'}</span>
                <span className="text-muted-foreground">Service Frequency:</span>
                <span>{selectedService.service_frequency || 'N/A'}</span>
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={selectedService.status === 'active' ? 'default' : 'secondary'}>
                  {selectedService.status}
                </Badge>
                <span className="text-muted-foreground">Type:</span>
                <span>{selectedService.is_rental_only ? 'Rental Only' : selectedService.is_rental ? 'Sale & Rental' : 'Sale'}</span>
              </div>
              {selectedService.description && (
                <div>
                  <span className="text-sm text-muted-foreground">Description:</span>
                  <p className="text-sm mt-1">{selectedService.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
