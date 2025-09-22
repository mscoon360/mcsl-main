import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package, DollarSign, Hash, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Link } from "react-router-dom";

// Your product catalog - ready for real inventory
const mockProducts: Array<{
  id: string,
  name: string,
  description: string,
  price: number,
  sku: string,
  category: string,
  stock: number,
  status: string,
  lastSold: string
}> = [];

export default function Products() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRentalProduct, setIsRentalProduct] = useState(false);
  const [isRentalOnly, setIsRentalOnly] = useState(false);
  const [editIsRentalProduct, setEditIsRentalProduct] = useState(false);
  const [editIsRentalOnly, setEditIsRentalOnly] = useState(false);
  const [productType, setProductType] = useState<'sale_only' | 'rental_only' | 'both'>('sale_only');
  const [editProductType, setEditProductType] = useState<'sale_only' | 'rental_only' | 'both'>('sale_only');
  const [products, setProducts] = useLocalStorage<Array<{id:string; name:string; description:string; price:number; sku:string; category:string; stock:number; status:string; lastSold:string; isRental?:boolean; isRentalOnly?:boolean;}>>('dashboard-products', []);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate statistics
  const totalProducts = products.length;
  const inStockProducts = products.filter(p => p.status === 'active').length;
  const lowStockProducts = products.filter(p => p.status === 'low_stock').length;
  const averagePrice = products.length > 0 ? products.reduce((sum, p) => sum + p.price, 0) / products.length : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'low_stock':
        return 'destructive';
      case 'out_of_stock':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'In Stock';
      case 'low_stock':
        return 'Low Stock';
      case 'out_of_stock':
        return 'Out of Stock';
      default:
        return status;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);

    const name = String(data.get('name') || '');
    const sku = String(data.get('sku') || '');
    const description = String(data.get('description') || '');
    const category = String(data.get('category') || '');
    const stock = parseInt(String(data.get('stock') || '0')) || 0;
    const unitPrice = parseFloat(String(data.get('price') || '0')) || 0;
    const rentalPriceVal = parseFloat(String(data.get('rentalPrice') || '0')) || 0;
    const price = productType === 'sale_only' ? unitPrice : rentalPriceVal;

    const status = stock > 10 ? 'active' : stock > 0 ? 'low_stock' : 'out_of_stock';

    const newProduct = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name,
      description,
      price,
      sku,
      category,
      stock,
      status,
      lastSold: new Date().toISOString(),
      isRental: productType !== 'sale_only',
      isRentalOnly: productType === 'rental_only',
    };

    setProducts((prev) => [...prev, newProduct]);

    toast({
      title: "Product Added Successfully!",
      description: "New product has been added to your catalog.",
    });
    setShowForm(false);
    setProductType('sale_only');
    form.reset();
  };

  const handleEdit = (product: typeof mockProducts[0]) => {
    setEditingProduct(product.id);
    const currentProduct = products.find(p => p.id === product.id);
    if (currentProduct?.isRentalOnly) {
      setEditProductType('rental_only');
    } else if (currentProduct?.isRental) {
      setEditProductType('both');
    } else {
      setEditProductType('sale_only');
    }
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    const name = String(data.get('name') || '');
    const sku = String(data.get('sku') || '');
    const description = String(data.get('description') || '');
    const category = String(data.get('category') || '');
    const stock = parseInt(String(data.get('stock') || '0')) || 0;
    const price = parseFloat(String(data.get('price') || '0')) || 0;
    const status = stock > 10 ? 'active' : stock > 0 ? 'low_stock' : 'out_of_stock';

    const updatedProduct = {
      id: editingProduct!,
      name,
      description,
      price,
      sku,
      category,
      stock,
      status,
      lastSold: new Date().toISOString(),
      isRental: editProductType !== 'sale_only',
      isRentalOnly: editProductType === 'rental_only',
    };

    setProducts(prev => prev.map(product => 
      product.id === editingProduct ? { ...product, ...updatedProduct } : product
    ));

    toast({
      title: "Product Updated Successfully!",
      description: "Product information has been updated."
    });

    setEditingProduct(null);
    setEditProductType('sale_only');
  };

  const handleDelete = (productId: string) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      setProducts(prev => prev.filter(product => product.id !== productId));
      toast({
        title: "Product Deleted",
        description: "Product has been removed from your catalog."
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Product Management</h1>
          <p className="text-muted-foreground">
            Manage your product catalog, pricing, and inventory levels.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? "Cancel" : "Add Product"}
        </Button>
      </div>

      {/* Add Product Form */}
      {showForm && (
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Add New Product</CardTitle>
            <CardDescription>
              Enter the product information below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="productName">Product Name *</Label>
                  <Input id="productName" name="name" placeholder="Medical Supplies Kit" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU/Product Code *</Label>
                  <Input id="sku" name="sku" placeholder="MSK-001" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Detailed product description..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {productType === 'sale_only' && (
                  <div className="space-y-2">
                    <Label htmlFor="price">Unit Price *</Label>
                    <Input id="price" name="price" type="number" step="0.01" placeholder="299.99" required />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" name="category" placeholder="Medical Supplies" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Initial Stock</Label>
                  <Input id="stock" name="stock" type="number" placeholder="50" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Product Availability</Label>
                  <Select value={productType} onValueChange={(value: 'sale_only' | 'rental_only' | 'both') => setProductType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale_only">Available for Sale Only</SelectItem>
                      <SelectItem value="rental_only">Available for Rental Only</SelectItem>
                      <SelectItem value="both">Available for Both Sale and Rental</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {productType !== 'sale_only' && (
                  <div className="space-y-2">
                    <Label htmlFor="rentalPrice">Rental Price (per month) *</Label>
                    <Input id="rentalPrice" name="rentalPrice" type="number" step="0.01" placeholder="50.00" required />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Any additional product information..."
                  className="min-h-[80px]"
                />
              </div>

              <Button type="submit" className="w-full">
                <Package className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Product Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              {totalProducts === 0 ? "Start building your catalog" : "Products in your catalog"}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Stock</CardTitle>
            <Package className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{inStockProducts}</div>
            <p className="text-xs text-muted-foreground">
              {totalProducts === 0 ? "Add products to track inventory" : "Products available"}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <Package className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{lowStockProducts}</div>
            <p className="text-xs text-muted-foreground">
              {totalProducts === 0 ? "Inventory tracking ready" : "Need restocking"}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Price</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${averagePrice.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {totalProducts === 0 ? "Start with your first product" : "Average product price"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Product List */}
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Product Catalog</CardTitle>
              <CardDescription>
                {filteredProducts.length} products in your catalog
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProducts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sold</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  editingProduct === product.id ? (
                    <TableRow key={product.id}>
                      <TableCell colSpan={8} className="p-4">
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor={`edit-name-${product.id}`}>Product Name</Label>
                              <Input
                                id={`edit-name-${product.id}`}
                                name="name"
                                defaultValue={product.name}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-sku-${product.id}`}>SKU</Label>
                              <Input
                                id={`edit-sku-${product.id}`}
                                name="sku"
                                defaultValue={product.sku}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-category-${product.id}`}>Category</Label>
                              <Input
                                id={`edit-category-${product.id}`}
                                name="category"
                                defaultValue={product.category}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-price-${product.id}`}>Price</Label>
                              <Input
                                id={`edit-price-${product.id}`}
                                name="price"
                                type="number"
                                step="0.01"
                                defaultValue={product.price}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-stock-${product.id}`}>Stock</Label>
                              <Input
                                id={`edit-stock-${product.id}`}
                                name="stock"
                                type="number"
                                defaultValue={product.stock}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`edit-description-${product.id}`}>Description</Label>
                              <Input
                                id={`edit-description-${product.id}`}
                                name="description"
                                defaultValue={product.description}
                              />
                            </div>
                           </div>
                          
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Product Availability</Label>
                              <Select value={editProductType} onValueChange={(value: 'sale_only' | 'rental_only' | 'both') => setEditProductType(value)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sale_only">Available for Sale Only</SelectItem>
                                  <SelectItem value="rental_only">Available for Rental Only</SelectItem>
                                  <SelectItem value="both">Available for Both Sale and Rental</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button type="submit" size="sm">Save</Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingProduct(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <Package className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold">{product.name}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {product.description}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Hash className="h-3 w-3 text-muted-foreground" />
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {product.sku}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell className="font-bold">
                        ${product.price.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${
                          product.stock > 10 ? 'text-success' : 
                          product.stock > 0 ? 'text-warning' : 'text-destructive'
                        }`}>
                          {product.stock} units
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(product.status)}>
                          {getStatusText(product.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(product.lastSold).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No products yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Start building your product catalog by adding your first product with pricing and inventory details.
              </p>
              <Button asChild>
                <Link to="#" onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Product
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}