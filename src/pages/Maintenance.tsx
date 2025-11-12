import { useState } from 'react';
import { useItemDependencies } from '@/hooks/useItemDependencies';
import { useProducts } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus, Wrench, AlertCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

export default function Maintenance() {
  const { dependencies, loading, addDependency, updateDependency, deleteDependency } = useItemDependencies();
  const { products } = useProducts();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const handleAddMaintenance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const maintenanceItem = {
      product_id: formData.get('product_id') as string,
      servicing_frequency: 'contract-dependent',
      description: formData.get('description') as string,
      last_serviced_date: formData.get('last_serviced_date') as string || undefined,
      next_service_date: formData.get('next_service_date') as string || undefined,
    };

    try {
      await addDependency(maintenanceItem);
      setIsAddDialogOpen(false);
      form.reset();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleEditMaintenance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const updates = {
      description: formData.get('description') as string,
      last_serviced_date: formData.get('last_serviced_date') as string || undefined,
      next_service_date: formData.get('next_service_date') as string || undefined,
    };

    try {
      await updateDependency(editingItem.id, updates);
      setIsEditDialogOpen(false);
      setEditingItem(null);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this maintenance item?')) {
      await deleteDependency(id);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.name || 'Unknown Product';
  };

  const isServiceDue = (nextServiceDate?: string) => {
    if (!nextServiceDate) return false;
    return new Date(nextServiceDate) <= new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p>Loading maintenance items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Maintenance</h1>
          <p className="text-muted-foreground">Manage maintenance schedules for your products</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Maintenance Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Add New Maintenance Item</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddMaintenance} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product_id">Rental Product *</Label>
                <Select name="product_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a rental product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products
                      .filter(p => p.needs_servicing && (p.is_rental || p.is_rental_only))
                      .map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {product.sku}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  name="description" 
                  placeholder="Describe the maintenance item (e.g., bin liners)..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="last_serviced_date">Last Serviced Date</Label>
                  <Input 
                    id="last_serviced_date" 
                    name="last_serviced_date" 
                    type="date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="next_service_date">Next Service Date</Label>
                  <Input 
                    id="next_service_date" 
                    name="next_service_date" 
                    type="date"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                <Wrench className="mr-2 h-4 w-4" />
                Add Maintenance Item
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {dependencies.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No maintenance items yet</h3>
              <p className="text-muted-foreground">Get started by adding your first maintenance item.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Last Serviced</TableHead>
                  <TableHead>Next Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dependencies.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {getProductName(item.product_id)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {item.description || '-'}
                    </TableCell>
                    <TableCell>
                      {item.last_serviced_date 
                        ? format(new Date(item.last_serviced_date), 'MMM dd, yyyy')
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {item.next_service_date 
                        ? format(new Date(item.next_service_date), 'MMM dd, yyyy')
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {item.next_service_date && isServiceDue(item.next_service_date) ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <AlertCircle className="h-3 w-3" />
                          Service Due
                        </Badge>
                      ) : (
                        <Badge variant="default">Up to Date</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Maintenance Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <form onSubmit={handleEditMaintenance} className="space-y-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <Input 
                  value={getProductName(editingItem.product_id)} 
                  disabled 
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_description">Description</Label>
                <Textarea 
                  id="edit_description" 
                  name="description" 
                  defaultValue={editingItem.description || ''}
                  placeholder="Describe the maintenance item (e.g., bin liners)..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_last_serviced_date">Last Serviced Date</Label>
                  <Input 
                    id="edit_last_serviced_date" 
                    name="last_serviced_date" 
                    type="date"
                    defaultValue={editingItem.last_serviced_date || ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_next_service_date">Next Service Date</Label>
                  <Input 
                    id="edit_next_service_date" 
                    name="next_service_date" 
                    type="date"
                    defaultValue={editingItem.next_service_date || ''}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                <Wrench className="mr-2 h-4 w-4" />
                Update Maintenance Item
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
