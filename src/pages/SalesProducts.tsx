import { useState, useEffect } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { useDivisions } from '@/hooks/useDivisions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, DollarSign, Package2, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SalesProducts() {
  const { products, loading, updateProduct } = useProducts();
  const { divisions } = useDivisions();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [salePrice, setSalePrice] = useState('');
  const [rentalPrice, setRentalPrice] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDivision, setFilterDivision] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const handleEditClick = (product: any) => {
    setEditingProduct(product);
    setSalePrice(product.price?.toString() || '');
    setRentalPrice(product.rental_price?.toString() || '');
    setIsEditDialogOpen(true);
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      const updates: any = {};
      
      // Update prices based on product type
      if (editingProduct.is_rental_only) {
        updates.rental_price = parseFloat(rentalPrice) || 0;
        updates.price = parseFloat(rentalPrice) || 0; // Keep price synced for rental-only
      } else if (editingProduct.is_rental && !editingProduct.is_rental_only) {
        // Both sale and rental
        updates.price = parseFloat(salePrice) || 0;
        updates.rental_price = parseFloat(rentalPrice) || 0;
      } else {
        // Sale only
        updates.price = parseFloat(salePrice) || 0;
      }

      await updateProduct(editingProduct.id, updates);
      
      toast({
        title: 'Price Updated',
        description: 'Product pricing has been updated successfully.',
      });
      
      setIsEditDialogOpen(false);
      setEditingProduct(null);
      setSalePrice('');
      setRentalPrice('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDialogClose = () => {
    setIsEditDialogOpen(false);
    setEditingProduct(null);
    setSalePrice('');
    setRentalPrice('');
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDivision = filterDivision === 'all' || product.division_id === filterDivision;
    const matchesStatus = filterStatus === 'all' || product.status === filterStatus;
    
    return matchesSearch && matchesDivision && matchesStatus;
  });

  const getProductType = (product: any) => {
    if (product.is_rental_only) return 'Rental Only';
    if (product.is_rental) return 'Sale & Rental';
    return 'Sale Only';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      active: 'default',
      low_stock: 'secondary',
      out_of_stock: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status.replace('_', ' ').toUpperCase()}</Badge>;
  };

  const getDivisionName = (divisionId: string | null) => {
    if (!divisionId) return 'N/A';
    const division = divisions.find(d => d.id === divisionId);
    return division?.name || 'N/A';
  };

  const calculateMargin = (salePrice: number, costPrice: number) => {
    if (!costPrice || costPrice === 0) return 'N/A';
    const margin = ((salePrice - costPrice) / salePrice) * 100;
    return `${margin.toFixed(1)}%`;
  };

  // Calculate statistics
  const activeProducts = filteredProducts.filter(p => p.status === 'active').length;
  const lowStockProducts = filteredProducts.filter(p => p.status === 'low_stock').length;
  const totalValue = filteredProducts.reduce((sum, p) => sum + (p.price * p.stock), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sales Product Catalog</h1>
          <p className="text-muted-foreground mt-1">Manage product selling prices</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
            <Package2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search">Search Products</Label>
              <Input
                id="search"
                placeholder="Search by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="division-filter">Filter by Division</Label>
              <Select value={filterDivision} onValueChange={setFilterDivision}>
                <SelectTrigger id="division-filter">
                  <SelectValue placeholder="All Divisions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Divisions</SelectItem>
                  {divisions.map((division) => (
                    <SelectItem key={division.id} value={division.id}>
                      {division.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-filter">Filter by Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="low_stock">Low Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Price Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product Pricing</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdatePrice}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <Input value={editingProduct?.name || ''} disabled />
              </div>
              
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={editingProduct?.sku || ''} disabled />
              </div>

              <div className="space-y-2">
                <Label>Cost Price per Unit (Reference)</Label>
                <Input 
                  value={editingProduct?.cost_price ? `$${editingProduct.cost_price.toFixed(2)}` : 'N/A'} 
                  disabled 
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label>Current Stock</Label>
                <Input value={editingProduct?.stock || 0} disabled className="bg-muted" />
              </div>

              {editingProduct && !editingProduct.is_rental_only && (
                <div className="space-y-2">
                  <Label htmlFor="sale_price">Sale Price *</Label>
                  <Input
                    id="sale_price"
                    type="number"
                    step="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                  {editingProduct?.cost_price && salePrice && (
                    <p className="text-sm text-muted-foreground">
                      Margin: {calculateMargin(parseFloat(salePrice), editingProduct.cost_price)}
                    </p>
                  )}
                </div>
              )}

              {editingProduct && (editingProduct.is_rental || editingProduct.is_rental_only) && (
                <div className="space-y-2">
                  <Label htmlFor="rental_price">Rental Price *</Label>
                  <Input
                    id="rental_price"
                    type="number"
                    step="0.01"
                    value={rentalPrice}
                    onChange={(e) => setRentalPrice(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button type="submit">Update Pricing</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Products Table */}
      {loading ? (
        <div className="text-center py-8">Loading products...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Products ({filteredProducts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Cost Price (per unit)</TableHead>
                  <TableHead className="text-right">Sale Price</TableHead>
                  <TableHead className="text-right">Rental Price</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground">
                      No products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{getDivisionName(product.division_id)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getProductType(product)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{product.stock}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        ${(product.cost_price || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {product.is_rental_only ? 'N/A' : `$${(product.price || 0).toFixed(2)}`}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {product.is_rental || product.is_rental_only 
                          ? `$${(product.rental_price || 0).toFixed(2)}`
                          : 'N/A'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        {product.is_rental_only 
                          ? 'N/A' 
                          : calculateMargin(product.price || 0, product.cost_price || 0)
                        }
                      </TableCell>
                      <TableCell>{getStatusBadge(product.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
