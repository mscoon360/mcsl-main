import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { Textarea } from "@/components/ui/textarea";
interface Supply {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  category: string | null;
  last_restock_date: string | null;
  min_stock_level: number;
  status: string;
}
export default function Inventory() {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const {
    products,
    loading: productsLoading
  } = useProducts();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);
  const [deleteSupplyId, setDeleteSupplyId] = useState<string | null>(null);
  useEffect(() => {
    fetchSupplies();
  }, []);
  const fetchSupplies = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("supplies").select("*").order("created_at", {
        ascending: false
      });
      if (error) throw error;
      setSupplies(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleAddSupply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      const {
        error
      } = await supabase.from("supplies").insert({
        user_id: user?.id,
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        quantity: parseInt(formData.get("quantity") as string),
        unit: formData.get("unit") as string,
        category: formData.get("category") as string,
        last_restock_date: formData.get("last_restock_date") as string || null,
        min_stock_level: parseInt(formData.get("min_stock_level") as string) || 0,
        status: "in stock"
      });
      if (error) throw error;
      toast({
        title: "Success",
        description: "Supply added successfully"
      });
      setIsAddDialogOpen(false);
      fetchSupplies();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const handleEditSupply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSupply) return;
    const formData = new FormData(e.currentTarget);
    try {
      const {
        error
      } = await supabase.from("supplies").update({
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        quantity: parseInt(formData.get("quantity") as string),
        unit: formData.get("unit") as string,
        category: formData.get("category") as string,
        last_restock_date: formData.get("last_restock_date") as string || null,
        min_stock_level: parseInt(formData.get("min_stock_level") as string) || 0
      }).eq("id", editingSupply.id);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Supply updated successfully"
      });
      setIsEditDialogOpen(false);
      setEditingSupply(null);
      fetchSupplies();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const handleDeleteSupply = async () => {
    if (!deleteSupplyId) return;
    try {
      const {
        error
      } = await supabase.from("supplies").delete().eq("id", deleteSupplyId);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Supply deleted successfully"
      });
      setDeleteSupplyId(null);
      fetchSupplies();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const getLatestRestockDate = () => {
    const dates = supplies.map(s => s.last_restock_date).filter(d => d !== null).sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime());
    return dates[0] || null;
  };
  if (loading || productsLoading) {
    return <div className="p-8">Loading...</div>;
  }
  return <div className="p-4 md:p-8 space-y-6">
      {/* Product Catalog Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Catalog
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No products found
                    </TableCell>
                  </TableRow> : products.map(product => <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>{product.category || "N/A"}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold ${product.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                          {product.status}
                        </span>
                      </TableCell>
                    </TableRow>)}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Last Restock Date */}
      <Card>
        
        
      </Card>

      {/* Supplies Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Supplies</CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Supply
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Supply</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSupply} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" name="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input id="category" name="category" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input id="quantity" name="quantity" type="number" min="0" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Input id="unit" name="unit" placeholder="e.g., boxes, pieces" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min_stock_level">Min Stock Level</Label>
                    <Input id="min_stock_level" name="min_stock_level" type="number" min="0" defaultValue="0" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_restock_date">Last Restock Date</Label>
                    <Input id="last_restock_date" name="last_restock_date" type="date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Supply</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Min Level</TableHead>
                  <TableHead>Last Restock</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplies.length === 0 ? <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No supplies found. Add your first supply to get started.
                    </TableCell>
                  </TableRow> : supplies.map(supply => <TableRow key={supply.id}>
                      <TableCell className="font-medium">{supply.name}</TableCell>
                      <TableCell>{supply.category || "N/A"}</TableCell>
                      <TableCell>
                        <span className={supply.quantity <= supply.min_stock_level ? "text-red-600 font-semibold" : ""}>
                          {supply.quantity}
                        </span>
                      </TableCell>
                      <TableCell>{supply.unit || "N/A"}</TableCell>
                      <TableCell>{supply.min_stock_level}</TableCell>
                      <TableCell>
                        {supply.last_restock_date ? new Date(supply.last_restock_date).toLocaleDateString() : "N/A"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => {
                      setEditingSupply(supply);
                      setIsEditDialogOpen(true);
                    }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteSupplyId(supply.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>)}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supply</DialogTitle>
          </DialogHeader>
          {editingSupply && <form onSubmit={handleEditSupply} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input id="edit-name" name="name" defaultValue={editingSupply.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Input id="edit-category" name="category" defaultValue={editingSupply.category || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-quantity">Quantity *</Label>
                  <Input id="edit-quantity" name="quantity" type="number" min="0" defaultValue={editingSupply.quantity} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-unit">Unit</Label>
                  <Input id="edit-unit" name="unit" defaultValue={editingSupply.unit || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-min_stock_level">Min Stock Level</Label>
                  <Input id="edit-min_stock_level" name="min_stock_level" type="number" min="0" defaultValue={editingSupply.min_stock_level} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-last_restock_date">Last Restock Date</Label>
                  <Input id="edit-last_restock_date" name="last_restock_date" type="date" defaultValue={editingSupply.last_restock_date || ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea id="edit-description" name="description" defaultValue={editingSupply.description || ""} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setEditingSupply(null);
            }}>
                  Cancel
                </Button>
                <Button type="submit">Update Supply</Button>
              </div>
            </form>}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteSupplyId} onOpenChange={() => setDeleteSupplyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this supply. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSupply}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
}