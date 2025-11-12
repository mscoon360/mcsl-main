import { useState } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePromotions } from '@/hooks/usePromotions';
import { useProducts } from '@/hooks/useProducts';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface BundleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  discount_type: 'percentage' | 'fixed' | 'none';
  discount_value: number;
}

export default function Promotions() {
  const { promotions, loading, addPromotion, updatePromotion, deletePromotion } = usePromotions();
  const { products } = useProducts();
  const [isOpen, setIsOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<any>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | 'none'>('none');
  const [discountValue, setDiscountValue] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);

  // Product selection state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemDiscountType, setItemDiscountType] = useState<'percentage' | 'fixed' | 'none'>('none');
  const [itemDiscountValue, setItemDiscountValue] = useState(0);

  const resetForm = () => {
    setName('');
    setDescription('');
    setDiscountType('none');
    setDiscountValue(0);
    setStartDate('');
    setEndDate('');
    setIsActive(true);
    setBundleItems([]);
    setEditingPromotion(null);
    setSelectedProductId('');
    setItemQuantity(1);
    setItemDiscountType('none');
    setItemDiscountValue(0);
  };

  const handleEdit = (promotion: any) => {
    setEditingPromotion(promotion);
    setName(promotion.name);
    setDescription(promotion.description || '');
    setDiscountType(promotion.discount_type || 'none');
    setDiscountValue(promotion.discount_value || 0);
    setStartDate(promotion.start_date || '');
    setEndDate(promotion.end_date || '');
    setIsActive(promotion.is_active);
    setBundleItems(promotion.bundle_items || []);
    setIsOpen(true);
  };

  const handleAddProduct = () => {
    if (!selectedProductId) {
      toast.error('Please select a product');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    if (bundleItems.find(item => item.product_id === selectedProductId)) {
      toast.error('Product already added to bundle');
      return;
    }

    const newItem: BundleItem = {
      product_id: selectedProductId,
      product_name: product.name,
      quantity: itemQuantity,
      discount_type: itemDiscountType,
      discount_value: itemDiscountValue,
    };

    setBundleItems([...bundleItems, newItem]);
    setSelectedProductId('');
    setItemQuantity(1);
    setItemDiscountType('none');
    setItemDiscountValue(0);
  };

  const handleRemoveProduct = (productId: string) => {
    setBundleItems(bundleItems.filter(item => item.product_id !== productId));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Please enter a promotion name');
      return;
    }

    if (bundleItems.length === 0) {
      toast.error('Please add at least one product to the bundle');
      return;
    }

    const promotionData = {
      name: name.trim(),
      description: description.trim(),
      discount_type: discountType,
      discount_value: discountValue,
      start_date: startDate || null,
      end_date: endDate || null,
      is_active: isActive,
      bundle_items: bundleItems,
    };

    if (editingPromotion) {
      await updatePromotion(editingPromotion.id, promotionData);
    } else {
      await addPromotion(promotionData);
    }

    setIsOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this promotion?')) {
      await deletePromotion(id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Promotions</h1>
          <p className="text-muted-foreground">Create and manage product bundles with discounts</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Promotion
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading promotions...</div>
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No promotions yet. Create your first promotion!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {promotions.map((promotion) => (
            <Card key={promotion.id} className={!promotion.is_active ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle>{promotion.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {promotion.description || 'No description'}
                    </CardDescription>
                  </div>
                  <Badge variant={promotion.is_active ? 'default' : 'secondary'}>
                    {promotion.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {promotion.discount_type !== 'none' && (
                  <div className="p-2 rounded-lg bg-accent">
                    <p className="text-sm font-medium">
                      Bundle Discount: {promotion.discount_type === 'percentage' 
                        ? `${promotion.discount_value}%` 
                        : `$${promotion.discount_value}`}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium">Bundle Items ({promotion.bundle_items?.length || 0}):</p>
                  <div className="space-y-1">
                    {promotion.bundle_items?.map((item: BundleItem, idx: number) => (
                      <div key={idx} className="text-sm flex items-center justify-between p-2 rounded bg-muted">
                        <span>
                          {item.product_name} x{item.quantity}
                        </span>
                        {item.discount_type !== 'none' && (
                          <Badge variant="outline" className="text-xs">
                            {item.discount_type === 'percentage' 
                              ? `-${item.discount_value}%` 
                              : `-$${item.discount_value}`}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {(promotion.start_date || promotion.end_date) && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    {promotion.start_date && <p>Start: {new Date(promotion.start_date).toLocaleDateString()}</p>}
                    {promotion.end_date && <p>End: {new Date(promotion.end_date).toLocaleDateString()}</p>}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(promotion)}
                  >
                    <Pencil className="mr-2 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(promotion.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPromotion ? 'Edit Promotion' : 'Create New Promotion'}</DialogTitle>
            <DialogDescription>
              Bundle products together and apply optional discounts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Promotion Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Spring Bundle Deal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="is-active">Active</Label>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4">Bundle Discount (Optional)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discount-type">Discount Type</Label>
                  <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                    <SelectTrigger id="discount-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Discount</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {discountType !== 'none' && (
                  <div className="space-y-2">
                    <Label htmlFor="discount-value">Discount Value</Label>
                    <Input
                      id="discount-value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4">Bundle Products *</h3>
              
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-base">Add Product</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="product">Product</Label>
                      <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                        <SelectTrigger id="product">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="item-discount-type">Item Discount (Optional)</Label>
                      <Select value={itemDiscountType} onValueChange={(v: any) => setItemDiscountType(v)}>
                        <SelectTrigger id="item-discount-type">
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
                      <div className="space-y-2">
                        <Label htmlFor="item-discount-value">Value</Label>
                        <Input
                          id="item-discount-value"
                          type="number"
                          min="0"
                          step="0.01"
                          value={itemDiscountValue}
                          onChange={(e) => setItemDiscountValue(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    )}
                  </div>

                  <Button type="button" onClick={handleAddProduct} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add to Bundle
                  </Button>
                </CardContent>
              </Card>

              {bundleItems.length > 0 && (
                <div className="space-y-2">
                  <Label>Bundle Items</Label>
                  {bundleItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Quantity: {item.quantity}
                          {item.discount_type !== 'none' && (
                            <span className="ml-2">
                              • Discount: {item.discount_type === 'percentage' 
                                ? `${item.discount_value}%` 
                                : `$${item.discount_value}`}
                            </span>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveProduct(item.product_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingPromotion ? 'Update' : 'Create'} Promotion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}