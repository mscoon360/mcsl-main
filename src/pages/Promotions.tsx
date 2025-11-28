import { useState } from 'react';
import { usePromotions, BundleItem as ImportedBundleItem } from '@/hooks/usePromotions';
import { useProducts } from '@/hooks/useProducts';
import { useSales } from '@/hooks/useSales';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Package, Tag, TrendingUp, DollarSign, Target } from 'lucide-react';
import { format } from 'date-fns';

type BundleItem = ImportedBundleItem;

const Promotions = () => {
  const { promotions, loading, addPromotion, updatePromotion, deletePromotion } = usePromotions();
  const { products } = useProducts();
  const { sales } = useSales();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discount_type: 'none' as 'percentage' | 'fixed' | 'none',
    discount_value: 0,
    start_date: '',
    end_date: '',
    is_active: true,
    bundle_items: [] as BundleItem[],
  });

  const [selectedProduct, setSelectedProduct] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemDiscountType, setItemDiscountType] = useState<'percentage' | 'fixed' | 'none'>('none');
  const [itemDiscountValue, setItemDiscountValue] = useState(0);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      discount_type: 'none',
      discount_value: 0,
      start_date: '',
      end_date: '',
      is_active: true,
      bundle_items: [],
    });
    setSelectedProduct('');
    setItemQuantity(1);
    setItemDiscountType('none');
    setItemDiscountValue(0);
  };

  const addProductToBundle = () => {
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const newItem: BundleItem = {
      product_id: product.id,
      product_name: product.name,
      quantity: itemQuantity,
      price: Number(product.price),
      discount_type: itemDiscountType,
      discount_value: itemDiscountType === 'none' ? 0 : itemDiscountValue,
    };

    setFormData(prev => ({
      ...prev,
      bundle_items: [...prev.bundle_items, newItem],
    }));

    setSelectedProduct('');
    setItemQuantity(1);
    setItemDiscountType('none');
    setItemDiscountValue(0);
  };

  const removeProductFromBundle = (index: number) => {
    setFormData(prev => ({
      ...prev,
      bundle_items: prev.bundle_items.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || formData.bundle_items.length === 0) return;
    try {
      await addPromotion(formData as any);
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating promotion:', error);
    }
  };

  const handleEdit = (promotion: any) => {
    setEditingPromotion(promotion);
    setFormData({
      name: promotion.name,
      description: promotion.description || '',
      discount_type: promotion.discount_type || 'none',
      discount_value: promotion.discount_value || 0,
      start_date: promotion.start_date || '',
      end_date: promotion.end_date || '',
      is_active: promotion.is_active,
      bundle_items: promotion.bundle_items || [],
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingPromotion || !formData.name || formData.bundle_items.length === 0) return;
    try {
      await updatePromotion(editingPromotion.id, formData as any);
      setIsEditDialogOpen(false);
      setEditingPromotion(null);
      resetForm();
    } catch (error) {
      console.error('Error updating promotion:', error);
    }
  };

  const calculateBundleTotal = (items: BundleItem[], globalDiscount?: { type: string; value: number }) => {
    let subtotal = items.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      let itemDiscount = 0;
      if (item.discount_type === 'percentage') itemDiscount = (itemTotal * (item.discount_value || 0)) / 100;
      else if (item.discount_type === 'fixed') itemDiscount = item.discount_value || 0;
      return sum + (itemTotal - itemDiscount);
    }, 0);

    if (globalDiscount?.type === 'percentage') subtotal -= (subtotal * (globalDiscount.value || 0)) / 100;
    else if (globalDiscount?.type === 'fixed') subtotal -= globalDiscount.value || 0;

    return Math.max(0, subtotal);
  };

  // Calculate promotional metrics
  const activePromotionsCount = promotions.filter(p => p.is_active).length;
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlyPromotionalSales = sales.filter(sale => {
    if (!sale.promotion_id) return false;
    const saleDate = new Date(sale.date);
    return saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
  });
  
  const monthlyPromotionalRevenue = monthlyPromotionalSales.reduce((sum, sale) => sum + Number(sale.total), 0);
  
  // Calculate average margin based on actual cost prices
  let totalCost = 0;
  monthlyPromotionalSales.forEach(sale => {
    sale.items.forEach(item => {
      const product = products.find(p => p.name === item.product_name);
      if (product && product.cost_price) {
        totalCost += Number(product.cost_price) * item.quantity;
      }
    });
  });
  
  const averageMargin = monthlyPromotionalRevenue > 0
    ? ((monthlyPromotionalRevenue - totalCost) / monthlyPromotionalRevenue) * 100
    : 0;

  if (loading) return <div className="p-8">Loading promotions...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Promotions</h1>
          <p className="text-muted-foreground mt-1">Create and manage product bundles with discounts</p>
        </div>
        <Button onClick={() => { 
          console.log('New Promotion button clicked');
          resetForm(); 
          setIsAddDialogOpen(true); 
          console.log('Dialog should open now, isAddDialogOpen:', true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          New Promotion
        </Button>
      </div>

      {/* Promotional Metrics Dashboard */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Promotions</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePromotionsCount}</div>
            <p className="text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Promotional Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${monthlyPromotionalRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {monthlyPromotionalSales.length} promotional {monthlyPromotionalSales.length === 1 ? 'sale' : 'sales'} this month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {averageMargin.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              On promotional sales
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {promotions.map((promotion) => {
          const originalTotal = promotion.bundle_items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const bundleTotal = calculateBundleTotal(
            promotion.bundle_items,
            { type: promotion.discount_type || 'none', value: promotion.discount_value }
          );
          const totalSavings = originalTotal - bundleTotal;
          const savingsPercentage = originalTotal > 0 ? (totalSavings / originalTotal) * 100 : 0;

          return (
            <Card key={promotion.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      <Tag className="h-5 w-5" />
                      {promotion.name}
                      <Badge variant={promotion.is_active ? "default" : "secondary"}>
                        {promotion.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="ml-2">
                        <Package className="h-3 w-3 mr-1" />
                        {promotion.bundle_items.length} {promotion.bundle_items.length === 1 ? 'Item' : 'Items'}
                      </Badge>
                    </CardTitle>
                    {promotion.description && <CardDescription className="mt-1">{promotion.description}</CardDescription>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(promotion)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deletePromotion(promotion.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Date Range */}
                  {(promotion.start_date || promotion.end_date) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium">Valid:</span>
                      {promotion.start_date && format(new Date(promotion.start_date), 'MMM dd, yyyy')}
                      {promotion.start_date && promotion.end_date && ' - '}
                      {promotion.end_date && format(new Date(promotion.end_date), 'MMM dd, yyyy')}
                    </div>
                  )}

                  {/* Bundle Items */}
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <div className="font-medium mb-2 text-sm">Bundle Contents:</div>
                    <div className="space-y-2">
                      {promotion.bundle_items.map((item, idx) => {
                        const itemTotal = item.price * item.quantity;
                        let itemDiscount = 0;
                        if (item.discount_type === 'percentage') itemDiscount = (itemTotal * (item.discount_value || 0)) / 100;
                        else if (item.discount_type === 'fixed') itemDiscount = item.discount_value || 0;
                        const itemFinalPrice = itemTotal - itemDiscount;

                        return (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="font-mono">
                                {item.quantity}x
                              </Badge>
                              <span className="font-medium">{item.product_name}</span>
                              {item.discount_type !== 'none' && (
                                <Badge variant="outline" className="text-xs">
                                  {item.discount_type === 'percentage' ? `-${item.discount_value}%` : `-$${item.discount_value}`}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {itemDiscount > 0 && (
                                <span className="text-muted-foreground line-through text-xs">
                                  ${itemTotal.toFixed(2)}
                                </span>
                              )}
                              <span className="font-mono font-medium">
                                ${itemFinalPrice.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pricing Summary */}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <div className="space-y-1">
                      {promotion.discount_type !== 'none' && (
                        <Badge variant="outline" className="mb-2">
                          Bundle Discount: {promotion.discount_type === 'percentage' ? `${promotion.discount_value}%` : `$${promotion.discount_value}`}
                        </Badge>
                      )}
                      {totalSavings > 0 && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Save: </span>
                          <span className="font-bold text-green-600">
                            ${totalSavings.toFixed(2)} ({savingsPercentage.toFixed(1)}%)
                          </span>
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        <span className="line-through">Original: ${originalTotal.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Bundle Price</div>
                      <div className="text-3xl font-bold text-primary">${bundleTotal.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {promotions.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No promotions yet</h3>
              <p className="text-muted-foreground mb-4">Create your first promotion to bundle products with discounts</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Promotion Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Promotion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Promotion Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Summer Bundle Deal"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Save on this amazing bundle..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Bundle Items *</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="product">Product</Label>
                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - ${product.price}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="item_discount_type">Item Discount</Label>
                    <Select value={itemDiscountType} onValueChange={(value: any) => setItemDiscountType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Discount</SelectItem>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {itemDiscountType !== 'none' && (
                    <div>
                      <Label htmlFor="item_discount_value">Value</Label>
                      <Input
                        id="item_discount_value"
                        type="number"
                        min="0"
                        step="0.01"
                        value={itemDiscountValue}
                        onChange={(e) => setItemDiscountValue(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  )}
                  <div className="flex items-end">
                    <Button type="button" onClick={addProductToBundle} disabled={!selectedProduct}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </div>
              </div>

              {formData.bundle_items.length > 0 && (
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.bundle_items.map((item, index) => {
                      const itemTotal = item.price * item.quantity;
                      let itemDiscount = 0;
                      if (item.discount_type === 'percentage') itemDiscount = (itemTotal * (item.discount_value || 0)) / 100;
                      else if (item.discount_type === 'fixed') itemDiscount = item.discount_value || 0;
                      
                      return (
                        <TableRow key={index}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>${item.price.toFixed(2)}</TableCell>
                          <TableCell>
                            {item.discount_type === 'percentage' && `${item.discount_value}%`}
                            {item.discount_type === 'fixed' && `$${item.discount_value}`}
                            {item.discount_type === 'none' && '-'}
                          </TableCell>
                          <TableCell>${(itemTotal - itemDiscount).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removeProductFromBundle(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Overall Bundle Discount</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="discount_type">Discount Type</Label>
                  <Select value={formData.discount_type} onValueChange={(value: any) => setFormData({ ...formData, discount_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Discount</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.discount_type !== 'none' && (
                  <div>
                    <Label htmlFor="discount_value">Discount Value</Label>
                    <Input
                      id="discount_value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.name || formData.bundle_items.length === 0}>
                Create Promotion
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Promotion Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Promotion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_name">Promotion Name *</Label>
              <Input
                id="edit_name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Summer Bundle Deal"
              />
            </div>
            <div>
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Save on this amazing bundle..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_start_date">Start Date</Label>
                <Input
                  id="edit_start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_end_date">End Date</Label>
                <Input
                  id="edit_end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="edit_is_active">Active</Label>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Bundle Items *</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit_product">Product</Label>
                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - ${product.price}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit_quantity">Quantity</Label>
                    <Input
                      id="edit_quantity"
                      type="number"
                      min="1"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="edit_item_discount_type">Item Discount</Label>
                    <Select value={itemDiscountType} onValueChange={(value: any) => setItemDiscountType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Discount</SelectItem>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {itemDiscountType !== 'none' && (
                    <div>
                      <Label htmlFor="edit_item_discount_value">Value</Label>
                      <Input
                        id="edit_item_discount_value"
                        type="number"
                        min="0"
                        step="0.01"
                        value={itemDiscountValue}
                        onChange={(e) => setItemDiscountValue(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  )}
                  <div className="flex items-end">
                    <Button type="button" onClick={addProductToBundle} disabled={!selectedProduct}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </div>
              </div>

              {formData.bundle_items.length > 0 && (
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.bundle_items.map((item, index) => {
                      const itemTotal = item.price * item.quantity;
                      let itemDiscount = 0;
                      if (item.discount_type === 'percentage') itemDiscount = (itemTotal * (item.discount_value || 0)) / 100;
                      else if (item.discount_type === 'fixed') itemDiscount = item.discount_value || 0;
                      
                      return (
                        <TableRow key={index}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>${item.price.toFixed(2)}</TableCell>
                          <TableCell>
                            {item.discount_type === 'percentage' && `${item.discount_value}%`}
                            {item.discount_type === 'fixed' && `$${item.discount_value}`}
                            {item.discount_type === 'none' && '-'}
                          </TableCell>
                          <TableCell>${(itemTotal - itemDiscount).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removeProductFromBundle(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Overall Bundle Discount</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit_discount_type">Discount Type</Label>
                  <Select value={formData.discount_type} onValueChange={(value: any) => setFormData({ ...formData, discount_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Discount</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.discount_type !== 'none' && (
                  <div>
                    <Label htmlFor="edit_discount_value">Discount Value</Label>
                    <Input
                      id="edit_discount_value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingPromotion(null); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={!formData.name || formData.bundle_items.length === 0}>
                Update Promotion
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Promotions;
