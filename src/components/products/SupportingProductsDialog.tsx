import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Search, Package } from 'lucide-react';
import { useSupportingProducts } from '@/hooks/useSupportingProducts';
import { Product } from '@/hooks/useProducts';

interface SupportingProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  allProducts: Product[];
  divisions: { id: string; name: string }[];
}

export const SupportingProductsDialog = ({
  open,
  onOpenChange,
  product,
  allProducts,
  divisions,
}: SupportingProductsDialogProps) => {
  const { supportingProducts, loading, addSupportingProduct, removeSupportingProduct, refetch } = useSupportingProducts(product?.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (open && product?.id) {
      refetch(product.id);
    }
  }, [open, product?.id]);

  const supportingProductIds = supportingProducts.map(sp => sp.supporting_product_id);
  
  const availableProducts = allProducts.filter(p => 
    p.id !== product?.id && 
    !supportingProductIds.includes(p.id) &&
    (searchTerm === '' || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const supportingProductDetails = supportingProducts.map(sp => {
    const productDetails = allProducts.find(p => p.id === sp.supporting_product_id);
    return { ...sp, product: productDetails };
  });

  const getDivisionName = (divisionId?: string) => {
    if (!divisionId) return '-';
    const division = divisions.find(d => d.id === divisionId);
    return division?.name || '-';
  };

  const handleAddSupportingProduct = async () => {
    if (!product?.id || !selectedProductId) return;
    
    setIsAdding(true);
    try {
      await addSupportingProduct(product.id, selectedProductId);
      await refetch(product.id);
      setSelectedProductId('');
      setSearchTerm('');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (relationId: string) => {
    await removeSupportingProduct(relationId);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Supporting Products - {product.name}
          </DialogTitle>
          <DialogDescription>
            Manage supporting products for this item. Add existing products or assign new ones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Supporting Product Section */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Add Supporting Product</h3>
            
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label>Search Products</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex-1 space-y-2">
                <Label>Select Product</Label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.length === 0 ? (
                      <SelectItem value="none" disabled>No products available</SelectItem>
                    ) : (
                      availableProducts.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleAddSupportingProduct} 
                disabled={!selectedProductId || isAdding}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          {/* Supporting Products List */}
          <div className="space-y-4">
            <h3 className="font-semibold">
              Current Supporting Products ({supportingProducts.length})
            </h3>
            
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : supportingProductDetails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                No supporting products assigned yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Rental Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supportingProductDetails.map((sp) => (
                    <TableRow key={sp.id}>
                      <TableCell className="font-mono text-sm">
                        {sp.product?.sku || '-'}
                      </TableCell>
                      <TableCell>{sp.product?.name || 'Unknown Product'}</TableCell>
                      <TableCell>{getDivisionName(sp.product?.division_id)}</TableCell>
                      <TableCell>
                        {sp.product?.price ? `$${sp.product.price.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {sp.product?.rental_price ? `$${sp.product.rental_price.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>{sp.product?.stock ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={sp.product?.status === 'active' ? 'default' : 'secondary'}>
                          {sp.product?.status || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(sp.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
