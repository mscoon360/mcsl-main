import { useState, useEffect } from 'react';
import { useProducts, Product } from '@/hooks/useProducts';
import { useDivisions } from '@/hooks/useDivisions';
import { useSupportingProducts } from '@/hooks/useSupportingProducts';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, DollarSign, Package2, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SupportingRelation {
  id: string;
  product_id: string;
  supporting_product_id: string;
}

interface RentalPaymentTerm {
  id: string;
  product_id: string;
  payment_term: string;
  rental_price: number;
  total_cost: number | null;
  unit_cost: number | null;
}

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  weekly: 52,
  'bi-monthly': 24,
  monthly: 12,
  quarterly: 4,
  'bi-annually': 2,
  annually: 1,
};

const getYearlyCost = (rentalPrice: number, paymentTerm: string): number => {
  const multiplier = FREQUENCY_MULTIPLIER[paymentTerm] || 12;
  return rentalPrice * multiplier;
};

const formatPaymentTerm = (term: string): string => {
  return term.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
};

export default function SalesProducts() {
  const { products, loading, updateProduct } = useProducts();
  const { divisions } = useDivisions();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [salePrice, setSalePrice] = useState('');
  const [rentalPrice, setRentalPrice] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set());
  const [expandedSubdivisions, setExpandedSubdivisions] = useState<Set<string>>(new Set());
  const [allSupportingRelations, setAllSupportingRelations] = useState<SupportingRelation[]>([]);
  const [rentalPaymentTerms, setRentalPaymentTerms] = useState<RentalPaymentTerm[]>([]);

  // Fetch all supporting product relations and rental payment terms
  useEffect(() => {
    const fetchSupportingRelations = async () => {
      const { data, error } = await supabase
        .from('product_supporting_items')
        .select('*');
      
      if (!error && data) {
        setAllSupportingRelations(data);
      }
    };
    const fetchRentalPaymentTerms = async () => {
      const { data, error } = await supabase
        .from('rental_payment_terms')
        .select('id, product_id, payment_term, rental_price, total_cost, unit_cost');
      
      if (!error && data) {
        setRentalPaymentTerms(data as RentalPaymentTerm[]);
      }
    };
    fetchSupportingRelations();
    fetchRentalPaymentTerms();
  }, []);

  // Check if a product is a supporting item
  const isSupportingProduct = (productId: string) => {
    return allSupportingRelations.some(rel => rel.supporting_product_id === productId);
  };

  // Get supporting products for a main product
  const getSupportingProductsForProduct = (productId: string) => {
    const supportingIds = allSupportingRelations
      .filter(rel => rel.product_id === productId)
      .map(rel => rel.supporting_product_id);
    return products.filter(p => supportingIds.includes(p.id));
  };

  // Get main products (excluding supporting items)
  const getMainProducts = () => {
    return products.filter(p => !isSupportingProduct(p.id));
  };

  const toggleDivision = (divisionId: string) => {
    const newExpanded = new Set(expandedDivisions);
    if (newExpanded.has(divisionId)) {
      newExpanded.delete(divisionId);
    } else {
      newExpanded.add(divisionId);
    }
    setExpandedDivisions(newExpanded);
  };

  const toggleSubdivision = (subdivisionId: string) => {
    const newExpanded = new Set(expandedSubdivisions);
    if (newExpanded.has(subdivisionId)) {
      newExpanded.delete(subdivisionId);
    } else {
      newExpanded.add(subdivisionId);
    }
    setExpandedSubdivisions(newExpanded);
  };

  const handleEditClick = (product: any) => {
    // Don't allow editing supporting products
    if (isSupportingProduct(product.id)) {
      toast({
        title: 'Cannot Edit',
        description: 'Supporting products cannot have their prices edited. They are used for cost calculation only.',
        variant: 'destructive',
      });
      return;
    }
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
      
      if (editingProduct.is_rental_only) {
        updates.rental_price = parseFloat(rentalPrice) || 0;
        updates.price = parseFloat(rentalPrice) || 0;
      } else if (editingProduct.is_rental && !editingProduct.is_rental_only) {
        updates.price = parseFloat(salePrice) || 0;
        updates.rental_price = parseFloat(rentalPrice) || 0;
      } else {
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

  const getProductType = (product: any) => {
    if (product.is_rental_only) return 'Rental Only';
    if (product.is_rental) return 'Sale & Rental';
    return 'Sale Only';
  };

  const getStatusBadge = (product: Product) => {
    // Derive status from stock level
    const derivedStatus = product.stock === 0 ? 'out_of_stock' : 
                          (product.min_stock && product.stock <= product.min_stock) ? 'low_stock' : 'active';
    
    const variants: Record<string, any> = {
      active: 'default',
      low_stock: 'secondary',
      out_of_stock: 'destructive',
    };
    return <Badge variant={variants[derivedStatus] || 'default'}>{derivedStatus.replace('_', ' ').toUpperCase()}</Badge>;
  };

  const calculateMarkup = (salePrice: number, costPrice: number) => {
    if (!costPrice || costPrice === 0) return 'N/A';
    const markup = (salePrice / costPrice) * 100;
    return `${markup.toFixed(0)}%`;
  };

  const formatSellingQty = (product: Product) => {
    if (!product.selling_unit_type) return '-';
    if (product.selling_unit_type === 'each') return 'Each';
    if (product.selling_unit_qty) {
      const unitLabel = product.selling_unit_type.charAt(0).toUpperCase() + product.selling_unit_type.slice(1);
      const priceDisplay = product.price > 0 ? ` @ $${product.price.toFixed(2)}` : '';
      return `1 ${unitLabel} (${product.selling_unit_qty} units)${priceDisplay}`;
    }
    return `Sold by ${product.selling_unit_type}`;
  };

  // Filter products by search
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Get products for a specific subdivision (main products only)
  const getProductsForSubdivision = (subdivisionId: string) => {
    return filteredProducts.filter(p => p.subdivision_id === subdivisionId && !isSupportingProduct(p.id));
  };

  // Get products for a division without subdivision (main products only)
  const getProductsForDivisionWithoutSubdivision = (divisionId: string) => {
    return filteredProducts.filter(p => p.division_id === divisionId && !p.subdivision_id && !isSupportingProduct(p.id));
  };

  // Get products without any division (main products only)
  const getProductsWithoutDivision = () => {
    return filteredProducts.filter(p => !p.division_id && !isSupportingProduct(p.id));
  };

  // Calculate statistics
  const mainProducts = getMainProducts();
  const activeProducts = mainProducts.filter(p => p.status === 'active').length;
  const lowStockProducts = mainProducts.filter(p => p.status === 'low_stock').length;
  const totalValue = mainProducts.reduce((sum, p) => sum + (p.price * p.stock), 0);

  // Get rental payment terms for a product
  const getTermsForProduct = (productId: string) => {
    return rentalPaymentTerms.filter(t => t.product_id === productId);
  };

  const isRentalProduct = (product: Product) => {
    return product.is_rental || product.is_rental_only;
  };

  // Render a single sale (spot price) product row
  const renderSaleProductRow = (product: Product, isSupporting: boolean = false) => {
    const rowClass = isSupporting 
      ? "bg-green-50 dark:bg-green-950/30" 
      : "bg-blue-50 dark:bg-blue-950/30";
    
    return (
      <TableRow key={product.id} className={rowClass}>
        <TableCell className="font-mono text-sm">
          {isSupporting && <span className="text-green-600 mr-1">↳</span>}
          {product.sku}
        </TableCell>
        <TableCell className="font-medium">{product.name}</TableCell>
        <TableCell>
          {isSupporting ? (
            <Badge variant="secondary" className="bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200">
              Supporting
            </Badge>
          ) : (
            <Badge variant="outline">Sale</Badge>
          )}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatSellingQty(product)}
        </TableCell>
        <TableCell className="text-right">{product.stock}</TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">
          ${(product.cost_price || 0).toFixed(2)}
        </TableCell>
        <TableCell className="text-right font-mono font-bold">
          ${(product.price || 0).toFixed(2)}
        </TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">
          {(() => {
            const vat = (product.price || 0) * 0.125;
            return `$${vat.toFixed(2)}`;
          })()}
        </TableCell>
        <TableCell className="text-right font-mono font-bold">
          {(() => {
            const total = (product.price || 0) * 1.125;
            return `$${total.toFixed(2)}`;
          })()}
        </TableCell>
        <TableCell className="text-right">
          {calculateMarkup(product.price || 0, product.cost_price || 0)}
        </TableCell>
        <TableCell>{getStatusBadge(product)}</TableCell>
        <TableCell>
          {!isSupporting && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEditClick(product)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  };

  // Render rental product rows (one per payment term with yearly cost)
  const renderRentalProductRows = (product: Product, isSupporting: boolean = false) => {
    const terms = getTermsForProduct(product.id);
    const rowClass = isSupporting 
      ? "bg-green-50 dark:bg-green-950/30" 
      : "bg-amber-50 dark:bg-amber-950/30";

    // If no payment terms configured, show single row with product's stored rental price
    if (terms.length === 0) {
      const yearlyCost = product.rental_price || product.price || 0;
      const vat = yearlyCost * 0.125;
      const total = yearlyCost + vat;
      return (
        <TableRow key={product.id} className={rowClass}>
          <TableCell className="font-mono text-sm">{product.sku}</TableCell>
          <TableCell className="font-medium">{product.name}</TableCell>
          <TableCell>
            <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
              Rental
            </Badge>
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">-</TableCell>
          <TableCell className="text-right">{product.stock}</TableCell>
          <TableCell className="text-right font-mono text-muted-foreground">-</TableCell>
          <TableCell className="text-right font-mono font-bold">${yearlyCost.toFixed(2)}</TableCell>
          <TableCell className="text-right font-mono text-muted-foreground">${vat.toFixed(2)}</TableCell>
          <TableCell className="text-right font-mono font-bold">${total.toFixed(2)}</TableCell>
          <TableCell className="text-right">-</TableCell>
          <TableCell>{getStatusBadge(product)}</TableCell>
          <TableCell>
            <Button variant="ghost" size="icon" onClick={() => handleEditClick(product)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
      );
    }

    // Show one row per payment term
    return terms.map((term, idx) => {
      const yearlyCost = getYearlyCost(term.rental_price, term.payment_term);
      const vat = yearlyCost * 0.125;
      const total = yearlyCost + vat;
      return (
        <TableRow key={`${product.id}-${term.payment_term}`} className={rowClass}>
          <TableCell className="font-mono text-sm">
            {idx === 0 ? product.sku : ''}
          </TableCell>
          <TableCell className="font-medium">
            {idx === 0 ? product.name : ''}
          </TableCell>
          <TableCell>
            <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
              {formatPaymentTerm(term.payment_term)}
            </Badge>
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {formatPaymentTerm(term.payment_term)}
          </TableCell>
          <TableCell className="text-right">{idx === 0 ? product.stock : ''}</TableCell>
          <TableCell className="text-right font-mono text-muted-foreground">-</TableCell>
          <TableCell className="text-right font-mono font-bold">${yearlyCost.toFixed(2)}</TableCell>
          <TableCell className="text-right font-mono text-muted-foreground">${vat.toFixed(2)}</TableCell>
          <TableCell className="text-right font-mono font-bold">${total.toFixed(2)}</TableCell>
          <TableCell className="text-right">-</TableCell>
          <TableCell>{idx === 0 ? getStatusBadge(product) : null}</TableCell>
          <TableCell>
            {idx === 0 && (
              <Button variant="ghost" size="icon" onClick={() => handleEditClick(product)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </TableCell>
        </TableRow>
      );
    });
  };

  // Check if a product list contains any rental products
  const hasRentalProducts = (productList: Product[]) => {
    return productList.some(p => isRentalProduct(p));
  };

  const renderProductTable = (productList: Product[]) => {
    if (productList.length === 0) return null;

    const rentalProducts = productList.filter(p => isRentalProduct(p));
    const saleProducts = productList.filter(p => !isRentalProduct(p));

    return (
      <div className="space-y-6">
        {/* Rental Products Table */}
        {rentalProducts.length > 0 && (
          <div>
            <h5 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-950/50 border border-amber-400"></div>
              Rental Products (Yearly Cost)
            </h5>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Service Frequency</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Cost Price</TableHead>
                  <TableHead className="text-right">Yearly Cost</TableHead>
                  <TableHead className="text-right">VAT 12.5%</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Markup</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentalProducts.map((product) => (
                  <>
                    {renderRentalProductRows(product, false)}
                    {getSupportingProductsForProduct(product.id).map((sp) =>
                      renderSaleProductRow(sp, true)
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Sale (Spot Price) Products Table */}
        {saleProducts.length > 0 && (
          <div>
            {rentalProducts.length > 0 && (
              <h5 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-950/50 border border-blue-400"></div>
                Spot Price Products (Unit Cost)
              </h5>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Selling Qty</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Cost Price</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">VAT 12.5%</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Markup</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saleProducts.map((product) => (
                  <>
                    {renderSaleProductRow(product, false)}
                    {getSupportingProductsForProduct(product.id).map((sp) =>
                      renderSaleProductRow(sp, true)
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading products...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Product/Service Costing</h1>
          <p className="text-muted-foreground mt-1">Manage product and service pricing</p>
        </div>
      </div>

      {/* Color Legend */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-950/50 border border-blue-300"></div>
          <span className="text-sm text-muted-foreground">Spot Price Product</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-amber-100 dark:bg-amber-950/50 border border-amber-400"></div>
          <span className="text-sm text-muted-foreground">Rental Product (Yearly Cost)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-950/50 border border-green-300"></div>
          <span className="text-sm text-muted-foreground">Supporting Product</span>
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

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="search">Search Products</Label>
            <Input
              id="search"
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
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
                      Markup: {calculateMarkup(parseFloat(salePrice), editingProduct.cost_price)}
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

      {/* Divisions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Divisions & Subdivisions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Division Name</TableHead>
                <TableHead>Subdivisions</TableHead>
                <TableHead className="text-right">Products</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {divisions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No divisions found.
                  </TableCell>
                </TableRow>
              ) : (
                divisions.map((division) => {
                  const divisionSubdivisions = division.subdivisions || [];
                  const productCount = filteredProducts.filter(p => p.division_id === division.id && !isSupportingProduct(p.id)).length;
                  return (
                    <TableRow 
                      key={division.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleDivision(division.id)}
                    >
                      <TableCell>
                        {expandedDivisions.has(division.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{division.name}</TableCell>
                      <TableCell>
                        {divisionSubdivisions.length > 0 
                          ? divisionSubdivisions.map(s => s.name).join(', ')
                          : 'None'
                        }
                      </TableCell>
                      <TableCell className="text-right">{productCount}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Products by Division */}
      {divisions.map((division) => {
        if (!expandedDivisions.has(division.id)) return null;
        
        const divisionSubdivisions = division.subdivisions || [];
        const productsWithoutSubdivision = getProductsForDivisionWithoutSubdivision(division.id);

        return (
          <Card key={division.id}>
            <CardHeader>
              <CardTitle>{division.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Products without subdivision */}
              {productsWithoutSubdivision.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-muted-foreground">General Products</h4>
                  {renderProductTable(productsWithoutSubdivision)}
                </div>
              )}

              {/* Subdivisions */}
              {divisionSubdivisions.map((subdivision) => {
                const subdivisionProducts = getProductsForSubdivision(subdivision.id);
                if (subdivisionProducts.length === 0) return null;

                return (
                  <div key={subdivision.id}>
                    <div 
                      className="flex items-center gap-2 cursor-pointer mb-2"
                      onClick={() => toggleSubdivision(subdivision.id)}
                    >
                      {expandedSubdivisions.has(subdivision.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <h4 className="font-medium">{subdivision.name}</h4>
                      <Badge variant="outline">{subdivisionProducts.length} products</Badge>
                    </div>
                    {expandedSubdivisions.has(subdivision.id) && renderProductTable(subdivisionProducts)}
                  </div>
                );
              })}

              {productsWithoutSubdivision.length === 0 && 
               divisionSubdivisions.every(s => getProductsForSubdivision(s.id).length === 0) && (
                <p className="text-muted-foreground text-center py-4">No products in this division.</p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Products without division */}
      {getProductsWithoutDivision().length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uncategorized Products</CardTitle>
          </CardHeader>
          <CardContent>
            {renderProductTable(getProductsWithoutDivision())}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
