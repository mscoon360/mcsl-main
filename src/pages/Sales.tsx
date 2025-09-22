import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, DollarSign, Calendar, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Mock data
const mockCustomers = [
  { id: "1", name: "ABC Corp", email: "contact@abc.com" },
  { id: "2", name: "HealthTech Inc", email: "info@healthtech.com" },
  { id: "3", name: "City Hospital", email: "admin@cityhospital.com" },
];

const mockProducts = [
  { id: "1", name: "Medical Supplies Kit", price: 299.99, sku: "MSK-001" },
  { id: "2", name: "Surgical Tools Set", price: 1499.99, sku: "STS-002" },
  { id: "3", name: "Diagnostic Equipment", price: 899.99, sku: "DE-003" },
];

const mockSales = [
  {
    id: "1",
    customer: "ABC Corp",
    total: 2400.00,
    items: [
      { product: "Medical Supplies Kit", quantity: 8, price: 299.99 }
    ],
    date: "2024-01-15",
    status: "completed"
  },
  {
    id: "2", 
    customer: "HealthTech Inc",
    total: 1850.00,
    items: [
      { product: "Diagnostic Equipment", quantity: 2, price: 899.99 },
      { product: "Medical Supplies Kit", quantity: 1, price: 299.99 }
    ],
    date: "2024-01-14",
    status: "completed"
  }
];

export default function Sales() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [salesItems, setSalesItems] = useState([
    { product: "", quantity: 1, price: 0, total: 0 }
  ]);

  const addSalesItem = () => {
    setSalesItems([...salesItems, { product: "", quantity: 1, price: 0, total: 0 }]);
  };

  const updateSalesItem = (index: number, field: string, value: any) => {
    const updated = [...salesItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'quantity' || field === 'price') {
      updated[index].total = updated[index].quantity * updated[index].price;
    }
    
    setSalesItems(updated);
  };

  const removeSalesItem = (index: number) => {
    setSalesItems(salesItems.filter((_, i) => i !== index));
  };

  const calculateGrandTotal = () => {
    return salesItems.reduce((sum, item) => sum + item.total, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Sale Logged Successfully!",
      description: `Total sale amount: $${calculateGrandTotal().toFixed(2)}`,
    });
    setShowForm(false);
    setSalesItems([{ product: "", quantity: 1, price: 0, total: 0 }]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales Management</h1>
          <p className="text-muted-foreground">
            Log sales, track performance, and manage your deals.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? "Cancel" : "Log New Sale"}
        </Button>
      </div>

      {/* New Sale Form */}
      {showForm && (
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Log New Sale</CardTitle>
            <CardDescription>
              Enter the details of your completed sale below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer</Label>
                  <Select required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockCustomers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Sale Date</Label>
                  <Input type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
              </div>

              {/* Sales Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">Sale Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addSalesItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {salesItems.map((item, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid grid-cols-5 gap-4 items-end">
                        <div className="space-y-2">
                          <Label>Product</Label>
                          <Select
                            value={item.product}
                            onValueChange={(value) => {
                              const product = mockProducts.find(p => p.id === value);
                              updateSalesItem(index, 'product', value);
                              if (product) {
                                updateSalesItem(index, 'price', product.price);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {mockProducts.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} - ${product.price}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateSalesItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unit Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => updateSalesItem(index, 'price', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Total</Label>
                          <div className="font-bold text-lg text-success">
                            ${item.total.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          {salesItems.length > 1 && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeSalesItem(index)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end">
                  <div className="text-right">
                    <p className="text-lg">Grand Total:</p>
                    <p className="text-3xl font-bold text-success">
                      ${calculateGrandTotal().toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional notes about this sale..."
                  className="min-h-[100px]"
                />
              </div>

              <Button type="submit" className="w-full" size="lg">
                <DollarSign className="h-4 w-4 mr-2" />
                Log Sale - ${calculateGrandTotal().toFixed(2)}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Sales History */}
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Sales History</CardTitle>
              <CardDescription>
                Recent sales transactions and their details.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search sales..." className="w-64" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {sale.customer}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {sale.items.map((item, idx) => (
                        <div key={idx} className="text-sm">
                          {item.quantity}x {item.product}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(sale.date).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={sale.status === 'completed' ? 'default' : 'secondary'}>
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-success">
                    ${sale.total.toFixed(2)}
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