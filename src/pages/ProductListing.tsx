import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Package, Layers, ChevronDown } from 'lucide-react';
import { useProducts, Product } from '@/hooks/useProducts';
import { useDivisions } from '@/hooks/useDivisions';
import { useSupportingProducts } from '@/hooks/useSupportingProducts';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const ProductListing = () => {
  const { products, loading } = useProducts();
  const { divisions } = useDivisions();
  const { supportingProducts } = useSupportingProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDivisions, setExpandedDivisions] = useState<Record<string, boolean>>({});

  // Get IDs of all supporting products
  const supportingProductIds = new Set(supportingProducts.map(sp => sp.supporting_product_id));

  // Filter to only main products (not supporting products)
  const mainProducts = products.filter(p => !supportingProductIds.has(p.id));

  // Filter products by search
  const filteredProducts = mainProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.category?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  // Group products by division and subdivision
  const getProductsByDivision = (divisionId: string) => {
    return filteredProducts.filter(p => p.division_id === divisionId);
  };

  const getProductsBySubdivision = (subdivisionId: string) => {
    return filteredProducts.filter(p => p.subdivision_id === subdivisionId);
  };

  const getUncategorizedProducts = () => {
    return filteredProducts.filter(p => !p.division_id);
  };

  const toggleDivision = (divisionId: string) => {
    setExpandedDivisions(prev => ({
      ...prev,
      [divisionId]: !prev[divisionId]
    }));
  };

  const renderProductRow = (product: Product) => {
    return (
      <TableRow key={product.id} className="bg-blue-50 dark:bg-blue-950/30">
        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
        <TableCell className="font-medium">{product.name}</TableCell>
        <TableCell>{product.category || '-'}</TableCell>
        <TableCell className="text-right">${product.price?.toFixed(2) || '0.00'}</TableCell>
        <TableCell className="text-right">${product.rental_price?.toFixed(2) || '-'}</TableCell>
        <TableCell className="text-center">{product.stock || 0}</TableCell>
        <TableCell>
          <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
            {product.status || 'active'}
          </Badge>
        </TableCell>
      </TableRow>
    );
  };

  const renderProductTable = (productList: Product[]) => {
    if (productList.length === 0) {
      return (
        <div className="text-center py-4 text-muted-foreground">
          No products found
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Product Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Sale Price</TableHead>
            <TableHead className="text-right">Rental Price</TableHead>
            <TableHead className="text-center">Stock</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {productList.map(product => renderProductRow(product))}
        </TableBody>
      </Table>
    );
  };

  // Statistics
  const totalProducts = mainProducts.length;
  const activeProducts = mainProducts.filter(p => p.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Listing</h1>
          <p className="text-muted-foreground">View product catalog organized by divisions</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProducts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Products</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeProducts}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Product Catalog */}
        <Card>
          <CardHeader>
            <CardTitle>Product Catalog</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading products...</div>
            ) : (
              <>
                {/* Divisions and Subdivisions */}
                {divisions.map(division => {
                  const divisionProducts = getProductsByDivision(division.id);
                  const hasProducts = divisionProducts.length > 0 || 
                    (division.subdivisions?.some(sub => getProductsBySubdivision(sub.id).length > 0));
                  
                  if (!hasProducts) return null;

                  return (
                    <Collapsible
                      key={division.id}
                      open={expandedDivisions[division.id] ?? true}
                      onOpenChange={() => toggleDivision(division.id)}
                    >
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                        <span className="font-semibold text-lg">{division.name}</span>
                        <ChevronDown className={`h-5 w-5 transition-transform ${
                          expandedDivisions[division.id] ?? true ? 'rotate-180' : ''
                        }`} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4 space-y-4">
                        {/* Products directly under division (no subdivision) */}
                        {divisionProducts.filter(p => !p.subdivision_id).length > 0 && (
                          <div className="ml-4">
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">General</h4>
                            {renderProductTable(divisionProducts.filter(p => !p.subdivision_id))}
                          </div>
                        )}

                        {/* Subdivisions */}
                        {division.subdivisions?.map(subdivision => {
                          const subProducts = getProductsBySubdivision(subdivision.id);
                          if (subProducts.length === 0) return null;

                          return (
                            <div key={subdivision.id} className="ml-4">
                              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                <span className="text-primary">↳</span> {subdivision.name}
                              </h4>
                              {renderProductTable(subProducts)}
                            </div>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}

                {/* Uncategorized Products */}
                {getUncategorizedProducts().length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 p-3 bg-muted rounded-lg">Uncategorized</h3>
                    {renderProductTable(getUncategorizedProducts())}
                  </div>
                )}

                {filteredProducts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No products found matching your search.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
  );
};

export default ProductListing;
