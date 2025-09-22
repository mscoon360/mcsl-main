import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package, DollarSign, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Mock product data
const mockProducts = [
  {
    id: "1",
    name: "Medical Supplies Kit",
    description: "Comprehensive medical supplies package for healthcare facilities",
    price: 299.99,
    sku: "MSK-001",
    category: "Medical Supplies",
    stock: 45,
    status: "active",
    lastSold: "2024-01-15"
  },
  {
    id: "2",
    name: "Surgical Tools Set",
    description: "Professional surgical instruments for medical procedures",
    price: 1499.99,
    sku: "STS-002",
    category: "Surgical Equipment",
    stock: 12,
    status: "active",
    lastSold: "2024-01-13"
  },
  {
    id: "3",
    name: "Diagnostic Equipment",
    description: "Advanced diagnostic tools for patient assessment",
    price: 899.99,
    sku: "DE-003",
    category: "Diagnostic Tools",
    stock: 8,
    status: "active",
    lastSold: "2024-01-14"
  },
  {
    id: "4",
    name: "Patient Monitoring Device",
    description: "Digital patient monitoring system with real-time alerts",
    price: 2299.99,
    sku: "PMD-004",
    category: "Monitoring Equipment",
    stock: 3,
    status: "low_stock",
    lastSold: "2024-01-10"
  },
  {
    id: "5",
    name: "Emergency Response Kit",
    description: "Complete emergency medical response kit for hospitals",
    price: 549.99,
    sku: "ERK-005",
    category: "Emergency Equipment",
    stock: 0,
    status: "out_of_stock",
    lastSold: "2024-01-05"
  }
];

export default function Products() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = mockProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    toast({
      title: "Product Added Successfully!",
      description: "New product has been added to your catalog.",
    });
    setShowForm(false);
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
                  <Input id="productName" placeholder="Medical Supplies Kit" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU/Product Code *</Label>
                  <Input id="sku" placeholder="MSK-001" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Detailed product description..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Unit Price *</Label>
                  <Input id="price" type="number" step="0.01" placeholder="299.99" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" placeholder="Medical Supplies" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Initial Stock</Label>
                  <Input id="stock" type="number" placeholder="50" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
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
            <div className="text-2xl font-bold">{mockProducts.length}</div>
            <p className="text-xs text-muted-foreground">
              Active catalog items
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Stock</CardTitle>
            <Package className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {mockProducts.filter(p => p.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for sale
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <Package className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {mockProducts.filter(p => p.status === 'low_stock').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Need reordering
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Price</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(mockProducts.reduce((sum, p) => sum + p.price, 0) / mockProducts.length).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per unit
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}