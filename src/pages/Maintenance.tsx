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
import { Pencil, Trash2, Plus, Wrench } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


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
      current_stock: parseInt(formData.get('current_stock') as string) || 0,
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
      current_stock: parseInt(formData.get('current_stock') as string) || 0,
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

              <div className="space-y-2">
                <Label htmlFor="current_stock">Current Stock Level *</Label>
                <Input 
                  id="current_stock" 
                  name="current_stock" 
                  type="number"
                  min="0"
                  placeholder="Enter current stock quantity"
                  required
                />
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
                  <TableHead>Current Stock</TableHead>
                  <TableHead>In Use</TableHead>
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
                      <Badge variant="outline">{item.current_stock || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">0</Badge>
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

              <div className="space-y-2">
                <Label htmlFor="edit_current_stock">Current Stock Level *</Label>
                <Input 
                  id="edit_current_stock" 
                  name="current_stock" 
                  type="number"
                  min="0"
                  defaultValue={editingItem.current_stock || 0}
                  required
                />
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
