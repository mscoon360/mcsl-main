import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { useDivisions } from '@/hooks/useDivisions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus, Package, Barcode, Info, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

export default function Products() {
  const { products, loading, addProduct, updateProduct, deleteProduct } = useProducts();
  const { divisions, loading: divisionsLoading, addDivision, updateDivision, deleteDivision } = useDivisions();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isDivisionDialogOpen, setIsDivisionDialogOpen] = useState(false);
  const [isEditDivisionDialogOpen, setIsEditDivisionDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingDivision, setEditingDivision] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productHistory, setProductHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [productType, setProductType] = useState<'sale_only' | 'rental_only' | 'both'>('sale_only');
  const [needsServicing, setNeedsServicing] = useState(false);
  const [divisionName, setDivisionName] = useState('');
  const [subdivisionNames, setSubdivisionNames] = useState<string[]>(['']);
  const [editDivisionName, setEditDivisionName] = useState('');
  const [editSubdivisionNames, setEditSubdivisionNames] = useState<string[]>(['']);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('');
  const [selectedSubdivisionId, setSelectedSubdivisionId] = useState<string>('');
  const [editDivisionId, setEditDivisionId] = useState<string>('');
  const [editSubdivisionId, setEditSubdivisionId] = useState<string>('');

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const name = formData.get('name') as string;
    const sku = formData.get('sku') as string;
    const description = formData.get('description') as string;
    const units = formData.get('units') as string;
    const stock = parseInt(formData.get('stock') as string) || 0;
    const supplier_name = formData.get('supplier_name') as string;
    const min_stock = parseInt(formData.get('min_stock') as string) || 0;
    const cost_price = parseFloat(formData.get('cost_price') as string) || 0;
    
    // Handle prices based on product type
    let price = 0;
    let rental_price = null;
    
    if (productType === 'both') {
      price = parseFloat(formData.get('sale_price') as string) || 0;
      rental_price = parseFloat(formData.get('rental_price') as string) || 0;
    } else if (productType === 'rental_only') {
      rental_price = parseFloat(formData.get('rental_price') as string) || 0;
      price = rental_price; // Set price to rental_price for display purposes
    } else {
      price = parseFloat(formData.get('sale_price') as string) || 0;
    }

    const newProduct = {
      name,
      sku,
      description,
      price,
      rental_price,
      division_id: selectedDivisionId || null,
      subdivision_id: selectedSubdivisionId || null,
      units,
      stock,
      status: stock > 10 ? 'active' : stock > 0 ? 'low_stock' : 'out_of_stock',
      is_rental: productType !== 'sale_only',
      is_rental_only: productType === 'rental_only',
      supplier_name,
      min_stock,
      cost_price,
      needs_servicing: (productType !== 'sale_only') && needsServicing,
    };

    try {
      const addedProduct = await addProduct(newProduct);
      setIsAddDialogOpen(false);
      form.reset();
      setProductType('sale_only');
      setNeedsServicing(false);
      setSelectedDivisionId('');
      setSelectedSubdivisionId('');
      
      toast({
        title: 'Product created',
        description: 'View barcodes for this product',
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/products/${addedProduct.id}/barcodes`)}
          >
            <Barcode className="mr-2 h-4 w-4" />
            View Barcodes
          </Button>
        ),
      });
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleEditProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const newStock = parseInt(formData.get('stock') as string) || 0;
    const oldStock = editingProduct.stock;
    const stockIncrease = newStock - oldStock;

    const updates = {
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      description: formData.get('description') as string,
      division_id: editDivisionId || null,
      subdivision_id: editSubdivisionId || null,
      units: formData.get('units') as string,
      stock: newStock,
      status: newStock > 10 ? 'active' : newStock > 0 ? 'low_stock' : 'out_of_stock',
      price: parseFloat(formData.get('price') as string) || 0,
    };

    try {
      await updateProduct(editingProduct.id, updates);
      
      // Generate new barcodes if stock increased
      if (stockIncrease > 0) {
        const newBarcodes = [];
        for (let i = 0; i < stockIncrease; i++) {
          // Generate unique barcode: timestamp + random string
          const barcode = `${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
          newBarcodes.push({
            product_id: editingProduct.id,
            barcode: barcode,
            status: 'in storage',
          });
        }

        // Insert in batches to handle large quantities
        const batchSize = 1000;
        for (let i = 0; i < newBarcodes.length; i += batchSize) {
          const batch = newBarcodes.slice(i, i + batchSize);
          const { error: barcodeError } = await supabase
            .from('product_items')
            .insert(batch);
          if (barcodeError) throw barcodeError;
        }

        toast({
          title: 'Product updated',
          description: `${stockIncrease} new barcode${stockIncrease !== 1 ? 's' : ''} generated`,
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/products/${editingProduct.id}/barcodes`)}
            >
              <Barcode className="mr-2 h-4 w-4" />
              View Barcodes
            </Button>
          ),
        });
      }

      setIsEditDialogOpen(false);
      setEditingProduct(null);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(id);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setEditDivisionId(product.division_id || '');
    setEditSubdivisionId(product.subdivision_id || '');
    setIsEditDialogOpen(true);
  };

  const handleViewDetails = async (product: any) => {
    setSelectedProduct(product);
    setIsDetailsDialogOpen(true);
    setLoadingHistory(true);

    try {
      // Fetch sale items for this product
      const { data: saleItems, error } = await supabase
        .from('sale_items')
        .select(`
          *,
          sales:sale_id (
            id,
            date,
            customer_name,
            total,
            status
          )
        `)
        .eq('product_name', product.name)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProductHistory(saleItems || []);
    } catch (error) {
      console.error('Error fetching product history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load product history',
        variant: 'destructive',
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAddDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!divisionName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a division name',
        variant: 'destructive',
      });
      return;
    }

    const validSubdivisions = subdivisionNames.filter(name => name.trim() !== '');
    
    try {
      await addDivision(divisionName, validSubdivisions);
      setIsDivisionDialogOpen(false);
      setDivisionName('');
      setSubdivisionNames(['']);
    } catch (error) {
      // Error handled in hook
    }
  };

  const addSubdivisionField = () => {
    setSubdivisionNames([...subdivisionNames, '']);
  };

  const removeSubdivisionField = (index: number) => {
    setSubdivisionNames(subdivisionNames.filter((_, i) => i !== index));
  };

  const updateSubdivisionName = (index: number, value: string) => {
    const updated = [...subdivisionNames];
    updated[index] = value;
    setSubdivisionNames(updated);
  };

  const handleEditDivision = (division: any) => {
    setEditingDivision(division);
    setEditDivisionName(division.name);
    setEditSubdivisionNames(
      division.subdivisions && division.subdivisions.length > 0
        ? division.subdivisions.map((sub: any) => sub.name)
        : ['']
    );
    setIsEditDivisionDialogOpen(true);
  };

  const handleUpdateDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editDivisionName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a division name',
        variant: 'destructive',
      });
      return;
    }

    const validSubdivisions = editSubdivisionNames.filter(name => name.trim() !== '');
    
    try {
      await updateDivision(editingDivision.id, editDivisionName, validSubdivisions);
      setIsEditDivisionDialogOpen(false);
      setEditingDivision(null);
      setEditDivisionName('');
      setEditSubdivisionNames(['']);
    } catch (error) {
      // Error handled in hook
    }
  };

  const addEditSubdivisionField = () => {
    setEditSubdivisionNames([...editSubdivisionNames, '']);
  };

  const removeEditSubdivisionField = (index: number) => {
    setEditSubdivisionNames(editSubdivisionNames.filter((_, i) => i !== index));
  };

  const updateEditSubdivisionName = (index: number, value: string) => {
    const updated = [...editSubdivisionNames];
    updated[index] = value;
    setEditSubdivisionNames(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p>Loading products...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDivisionDialogOpen} onOpenChange={setIsDivisionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Division
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Division</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddDivision} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="division-name">Division Name *</Label>
                  <Input
                    id="division-name"
                    value={divisionName}
                    onChange={(e) => setDivisionName(e.target.value)}
                    placeholder="Enter division name"
                    required
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Subdivisions</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addSubdivisionField}
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      Add Subdivision
                    </Button>
                  </div>

                  {subdivisionNames.map((name, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={name}
                        onChange={(e) => updateSubdivisionName(index, e.target.value)}
                        placeholder={`Subdivision ${index + 1}`}
                      />
                      {subdivisionNames.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSubdivisionField(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button type="submit" className="w-full">
                  Create Division
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input id="sku" name="sku" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" />
              </div>

              <div className="space-y-2">
                <Label>Product Availability</Label>
                <RadioGroup value={productType} onValueChange={(value: any) => setProductType(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sale_only" id="sale_only" />
                    <Label htmlFor="sale_only">Available for Sale Only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="rental_only" id="rental_only" />
                    <Label htmlFor="rental_only">Available for Rental Only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="both" id="both" />
                    <Label htmlFor="both">Available for Both</Label>
                  </div>
                </RadioGroup>
              </div>

              {(productType === 'rental_only' || productType === 'both') && (
                <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/50">
                  <Checkbox 
                    id="needs_servicing" 
                    checked={needsServicing}
                    onCheckedChange={(checked) => setNeedsServicing(checked as boolean)}
                  />
                  <div className="flex flex-col">
                    <Label htmlFor="needs_servicing" className="font-medium cursor-pointer">
                      This item requires servicing
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      Enable this for items like bins that need liner replacements or regular maintenance
                    </span>
                  </div>
                </div>
              )}

              {productType === 'both' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sale_price">Sale Price *</Label>
                    <Input id="sale_price" name="sale_price" type="number" step="0.01" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rental_price">Rental Price *</Label>
                    <Input id="rental_price" name="rental_price" type="number" step="0.01" required />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor={productType === 'rental_only' ? 'rental_price' : 'sale_price'}>
                    {productType === 'rental_only' ? 'Rental Price' : 'Sale Price'} *
                  </Label>
                  <Input 
                    id={productType === 'rental_only' ? 'rental_price' : 'sale_price'} 
                    name={productType === 'rental_only' ? 'rental_price' : 'sale_price'} 
                    type="number" 
                    step="0.01" 
                    required 
                  />
                </div>
              )}

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="division">Division</Label>
                  <select
                    id="division"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={selectedDivisionId}
                    onChange={(e) => {
                      setSelectedDivisionId(e.target.value);
                      setSelectedSubdivisionId('');
                    }}
                  >
                    <option value="">Select Division</option>
                    {divisions.map((div) => (
                      <option key={div.id} value={div.id}>
                        {div.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subdivision">Subdivision</Label>
                  <select
                    id="subdivision"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={selectedSubdivisionId}
                    onChange={(e) => setSelectedSubdivisionId(e.target.value)}
                    disabled={!selectedDivisionId}
                  >
                    <option value="">Select Subdivision</option>
                    {selectedDivisionId && divisions.find(d => d.id === selectedDivisionId)?.subdivisions?.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Initial Stock *</Label>
                  <Input id="stock" name="stock" type="number" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="units">Units</Label>
                  <Input id="units" name="units" placeholder="e.g., cases, ml, litres" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier_name">Supplier Name *</Label>
                  <Input id="supplier_name" name="supplier_name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_stock">Minimum Stock *</Label>
                  <Input id="min_stock" name="min_stock" type="number" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost_price">Cost Price *</Label>
                  <Input id="cost_price" name="cost_price" type="number" step="0.01" required />
                </div>
              </div>

              <Button type="submit" className="w-full">
                <Package className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Divisions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Divisions & Subdivisions</CardTitle>
        </CardHeader>
        <CardContent>
          {divisionsLoading ? (
            <p className="text-muted-foreground">Loading divisions...</p>
          ) : divisions.length === 0 ? (
            <p className="text-muted-foreground">No divisions created yet. Click "Add Division" to create one.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Division Name</TableHead>
                  <TableHead>Subdivisions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {divisions.map((division) => (
                  <TableRow key={division.id}>
                    <TableCell className="font-medium">{division.name}</TableCell>
                    <TableCell>
                      {division.subdivisions && division.subdivisions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {division.subdivisions.map((sub) => (
                            <Badge key={sub.id} variant="secondary">
                              {sub.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No subdivisions</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditDivision(division)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteDivision(division.id)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Edit Division Dialog */}
      <Dialog open={isEditDivisionDialogOpen} onOpenChange={setIsEditDivisionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Division</DialogTitle>
          </DialogHeader>
          {editingDivision && (
            <form onSubmit={handleUpdateDivision} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-division-name">Division Name *</Label>
                <Input
                  id="edit-division-name"
                  value={editDivisionName}
                  onChange={(e) => setEditDivisionName(e.target.value)}
                  placeholder="Enter division name"
                  required
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Subdivisions</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEditSubdivisionField}
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    Add Subdivision
                  </Button>
                </div>

                {editSubdivisionNames.map((name, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={name}
                      onChange={(e) => updateEditSubdivisionName(index, e.target.value)}
                      placeholder={`Subdivision ${index + 1}`}
                    />
                    {editSubdivisionNames.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEditSubdivisionField(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button type="submit" className="w-full">
                Update Division
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Product Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No products yet</h3>
              <p className="text-muted-foreground">Get started by adding your first product.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Subdivision</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Cost Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell 
                      className="font-medium text-primary cursor-pointer hover:underline"
                      onClick={() => handleViewDetails(product)}
                    >
                      {product.name}
                    </TableCell>
                    <TableCell>{product.sku}</TableCell>
                    <TableCell>{product.supplier_name || '-'}</TableCell>
                    <TableCell>
                      {product.division_id 
                        ? divisions.find(d => d.id === product.division_id)?.name || '-'
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {product.subdivision_id 
                        ? divisions.find(d => d.id === product.division_id)?.subdivisions?.find(s => s.id === product.subdivision_id)?.name || '-'
                        : '-'}
                    </TableCell>
                    <TableCell>${product.price.toFixed(2)}</TableCell>
                    <TableCell>${product.cost_price?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>
                      {product.stock === 0 ? (
                        <span className="text-destructive font-semibold">No Stock</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span>{product.stock}</span>
                          {product.min_stock > 0 && product.stock <= product.min_stock && (
                            <Badge variant="destructive" className="text-xs w-fit">
                              Below Min
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.stock === 0 || product.status === 'low_stock' ? 'destructive' : product.status === 'active' ? 'default' : 'secondary'}>
                        {product.stock === 0 ? 'No Stock' : product.status.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{product.is_rental_only ? 'Rental Only' : product.is_rental ? 'Both' : 'Sale Only'}</span>
                        {product.needs_servicing && (
                          <Badge variant="outline" className="text-xs">
                            Requires servicing
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/products/${product.id}/barcodes`)}
                          title="View Barcodes"
                        >
                          <Barcode className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <form onSubmit={handleEditProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Product Name *</Label>
                  <Input id="edit-name" name="name" defaultValue={editingProduct.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sku">SKU *</Label>
                  <Input id="edit-sku" name="sku" defaultValue={editingProduct.sku} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea id="edit-description" name="description" defaultValue={editingProduct.description} />
              </div>

              <div className="grid grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Price *</Label>
                  <Input id="edit-price" name="price" type="number" step="0.01" defaultValue={editingProduct.price} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-division">Division</Label>
                  <select
                    id="edit-division"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={editDivisionId}
                    onChange={(e) => {
                      setEditDivisionId(e.target.value);
                      setEditSubdivisionId('');
                    }}
                  >
                    <option value="">Select Division</option>
                    {divisions.map((div) => (
                      <option key={div.id} value={div.id}>
                        {div.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-subdivision">Subdivision</Label>
                  <select
                    id="edit-subdivision"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={editSubdivisionId}
                    onChange={(e) => setEditSubdivisionId(e.target.value)}
                    disabled={!editDivisionId}
                  >
                    <option value="">Select Subdivision</option>
                    {editDivisionId && divisions.find(d => d.id === editDivisionId)?.subdivisions?.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-stock">Stock</Label>
                  <Input id="edit-stock" name="stock" type="number" defaultValue={editingProduct.stock} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-units">Units</Label>
                  <Input id="edit-units" name="units" defaultValue={editingProduct.units} placeholder="e.g., cases, ml, litres" />
                </div>
              </div>

              <Button type="submit" className="w-full">
                Update Product
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Product Name</Label>
                    <p className="font-semibold">{selectedProduct.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">SKU</Label>
                    <p className="font-semibold">{selectedProduct.sku}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="font-semibold">{selectedProduct.description || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Division</Label>
                    <p className="font-semibold">
                      {selectedProduct.division_id 
                        ? divisions.find(d => d.id === selectedProduct.division_id)?.name || 'N/A'
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Subdivision</Label>
                    <p className="font-semibold">
                      {selectedProduct.subdivision_id 
                        ? divisions.find(d => d.id === selectedProduct.division_id)?.subdivisions?.find(s => s.id === selectedProduct.subdivision_id)?.name || 'N/A'
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <p className="font-semibold">
                      {selectedProduct.is_rental_only ? 'Rental Only' : selectedProduct.is_rental ? 'Both Sale & Rental' : 'Sale Only'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Supplier</Label>
                    <p className="font-semibold">{selectedProduct.supplier_name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Sale Price</Label>
                    <p className="font-semibold">${selectedProduct.price.toFixed(2)}</p>
                  </div>
                  {selectedProduct.rental_price && (
                    <div>
                      <Label className="text-muted-foreground">Rental Price</Label>
                      <p className="font-semibold">${selectedProduct.rental_price.toFixed(2)}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">Cost Price</Label>
                    <p className="font-semibold">${selectedProduct.cost_price?.toFixed(2) || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Current Stock</Label>
                    <p className="font-semibold">{selectedProduct.stock} {selectedProduct.units || 'units'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Minimum Stock</Label>
                    <p className="font-semibold">{selectedProduct.min_stock || 0} {selectedProduct.units || 'units'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge variant={selectedProduct.stock === 0 || selectedProduct.status === 'low_stock' ? 'destructive' : 'default'}>
                      {selectedProduct.status.replace(/_/g, ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">
                  {selectedProduct.is_rental_only ? 'Rental History' : 'Purchase History'}
                </h3>
                {loadingHistory ? (
                  <p className="text-center py-8 text-muted-foreground">Loading history...</p>
                ) : productHistory.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No {selectedProduct.is_rental_only ? 'rental' : 'purchase'} history available
                  </p>
                ) : (
                  <div className="space-y-4">
                    {selectedProduct.is_rental_only ? (
                      // Rental history
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Start Date</TableHead>
                            <TableHead>End Date</TableHead>
                            <TableHead>Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productHistory.filter(item => item.is_rental).map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{new Date(item.sales.date).toLocaleDateString()}</TableCell>
                              <TableCell>{item.sales.customer_name}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>{item.payment_period || 'N/A'}</TableCell>
                              <TableCell>{item.start_date ? new Date(item.start_date).toLocaleDateString() : 'N/A'}</TableCell>
                              <TableCell>{item.end_date ? new Date(item.end_date).toLocaleDateString() : 'N/A'}</TableCell>
                              <TableCell>${(item.price * item.quantity).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      // Purchase history
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Unit Price</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productHistory.filter(item => !item.is_rental).map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{new Date(item.sales.date).toLocaleDateString()}</TableCell>
                              <TableCell>{item.sales.customer_name}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>${item.price.toFixed(2)}</TableCell>
                              <TableCell>${(item.price * item.quantity).toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge variant={item.sales.status === 'completed' ? 'default' : 'secondary'}>
                                  {item.sales.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
