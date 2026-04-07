import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Minus, Trash2, ShoppingCart, ChevronsUpDown, Check, User, Receipt, X, Package, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProducts } from "@/hooks/useProducts";
import { useServices } from "@/hooks/useServices";
import { useCustomers } from "@/hooks/useCustomers";
import { usePromotions } from "@/hooks/usePromotions";
import { useRentalPaymentTerms, RentalPaymentTerm, PaymentTerm } from "@/hooks/useRentalPaymentTerms";
import { useAuth } from "@/contexts/AuthContext";
import { useDivisions } from "@/hooks/useDivisions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const PAYMENT_TERM_LABELS: Record<PaymentTerm, string> = {
  'weekly': 'Weekly',
  'bi-monthly': 'Bi-Monthly',
  'monthly': 'Monthly'
};

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  isRental: boolean;
  isService: boolean;
  discountType: 'none' | 'percentage' | 'fixed';
  discountValue: number;
  paymentTerm?: PaymentTerm;
  paymentTerms?: RentalPaymentTerm[];
}

export default function PointOfSale() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { products, updateProduct } = useProducts();
  const { services } = useServices();
  const { customers } = useCustomers();
  const { promotions } = usePromotions();
  const { getPaymentTermsForProduct } = useRentalPaymentTerms();
  const { divisions } = useDivisions();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchValue, setCustomerSearchValue] = useState("");
  const [selectedPromotion, setSelectedPromotion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [posTab, setPosTab] = useState<'products' | 'services'>('products');

  // Filter products for POS (only main products, exclude rental-only)
  const availableProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || p.division_id === selectedCategory;
      return matchesSearch && matchesCategory && p.status !== 'discontinued';
    });
  }, [products, searchTerm, selectedCategory]);

  // Filter services for POS
  const availableServices = useMemo(() => {
    return services.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || s.division_id === selectedCategory;
      return matchesSearch && matchesCategory && s.status !== 'discontinued';
    });
  }, [services, searchTerm, selectedCategory]);

  const addToCart = async (product: any, isService = false) => {
    const existingIndex = cart.findIndex(item => item.productId === product.id && item.isService === isService);
    if (existingIndex >= 0) {
      updateCartQuantity(existingIndex, cart[existingIndex].quantity + 1);
      return;
    }

    let paymentTerms: RentalPaymentTerm[] = [];
    if (!isService && (product.is_rental || product.is_rental_only)) {
      paymentTerms = await getPaymentTermsForProduct(product.id);
    }

    const newItem: CartItem = {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPrice: product.is_rental ? (paymentTerms[0]?.rental_price || product.rental_price || product.price) : product.price,
      isRental: product.is_rental || product.is_rental_only || false,
      isService,
      discountType: 'none',
      discountValue: 0,
      paymentTerm: paymentTerms.length > 0 ? paymentTerms[0].payment_term as PaymentTerm : undefined,
      paymentTerms,
    };

    setCart(prev => [...prev, newItem]);
  };

  const updateCartQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setCart(prev => prev.map((item, i) => i === index ? { ...item, quantity: newQty } : item));
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer("");
    setSelectedPromotion("");
  };

  const getItemTotal = (item: CartItem) => {
    const subtotal = item.quantity * item.unitPrice;
    if (item.discountType === 'percentage') return subtotal - (subtotal * item.discountValue / 100);
    if (item.discountType === 'fixed') return subtotal - item.discountValue;
    return subtotal;
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + getItemTotal(item), 0);

  const getPromotionDiscount = () => {
    if (!selectedPromotion) return 0;
    const promo = promotions.find(p => p.id === selectedPromotion);
    if (!promo) return 0;
    if (promo.discount_type === 'percentage') return (cartSubtotal * (promo.discount_value || 0)) / 100;
    if (promo.discount_type === 'fixed') return promo.discount_value || 0;
    return 0;
  };

  const grandTotal = Math.max(0, cartSubtotal - getPromotionDiscount());

  const handlePaymentTermChange = (index: number, term: PaymentTerm) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const selectedTerm = item.paymentTerms?.find(t => t.payment_term === term);
      return {
        ...item,
        paymentTerm: term,
        unitPrice: selectedTerm?.rental_price || item.unitPrice,
      };
    }));
  };

  const handleApplyPromotion = (promotionId: string) => {
    const promotion = promotions.find(p => p.id === promotionId);
    if (!promotion) return;

    const newItems: CartItem[] = promotion.bundle_items.map((bundleItem: any) => {
      const product = products.find(p => p.id === bundleItem.product_id);
      return {
        productId: bundleItem.product_id,
        productName: product?.name || 'Unknown Product',
        quantity: bundleItem.quantity,
        unitPrice: bundleItem.price,
        isRental: false,
        isService: false,
        discountType: bundleItem.discount_type || 'none',
        discountValue: bundleItem.discount_value || 0,
      };
    });

    setCart(newItems);
    setSelectedPromotion(promotionId);
    toast({ title: "Promotion Applied", description: `${promotion.name} has been applied.` });
  };

  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;
    if (!selectedCustomer) {
      toast({ title: "Select a customer", description: "Please select a customer before checkout.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      const customerName = customer?.name || customer?.company || 'Unknown';
      const saleDate = new Date().toISOString().split('T')[0];

      // Check stock
      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (product && !item.isRental && product.stock < item.quantity) {
          toast({ title: "Insufficient Stock", description: `${item.productName} only has ${product.stock} units available.`, variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
      }

      // Determine VAT
      const isVatable = customer?.vatable !== false;
      const vatRate = isVatable ? 0.125 : 0;
      const vatAmount = grandTotal * vatRate;

      // Insert sale
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{
          user_id: user.id,
          customer_name: customerName,
          total: grandTotal + vatAmount,
          date: saleDate,
          status: 'completed',
          promotion_id: selectedPromotion || null,
          vat_amount: vatAmount,
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      // Insert sale items
      const saleItems = cart.map(item => ({
        sale_id: saleData.id,
        product_name: item.productName,
        quantity: item.quantity,
        price: item.unitPrice,
        is_rental: item.isRental,
        contract_length: item.isRental ? '12 months' : null,
        payment_period: item.paymentTerm || null,
        item_discount_type: item.discountType !== 'none' ? item.discountType : null,
        item_discount_value: item.discountValue || 0,
        vat_amount: getItemTotal(item) * vatRate,
      }));

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
      if (itemsError) throw itemsError;

      // Update stock for non-rental items
      for (const item of cart) {
        if (!item.isRental) {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            await updateProduct(item.productId, {
              stock: product.stock - item.quantity,
              last_sold: saleDate,
            });
          }
        }
      }

      // Create fulfillment items
      const fulfillmentItems = cart.map(item => ({
        sale_id: saleData.id,
        customer: customerName,
        product: item.productName,
        quantity: item.quantity,
        user_id: user.id,
        delivery_address: customer?.address || null,
        status: 'pending',
      }));

      await supabase.from('fulfillment_items').insert(fulfillmentItems);

      toast({ title: "Sale Completed!", description: `Sale of $${(grandTotal + vatAmount).toFixed(2)} recorded successfully.` });
      clearCart();
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({ title: "Checkout Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-120px)]">
      {/* Left Panel - Product Grid */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {divisions.map(div => (
                <SelectItem key={div.id} value={div.id}>{div.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {availableProducts.map(product => (
              <Card
                key={product.id}
                className="cursor-pointer hover:border-primary transition-colors group"
                onClick={() => addToCart(product)}
              >
                <CardContent className="p-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                        {product.name}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-bold text-primary">
                        ${(product.is_rental ? (product.rental_price || product.price) : product.price).toFixed(2)}
                      </span>
                      <Badge variant={product.stock > 0 ? "secondary" : "destructive"} className="text-xs">
                        {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                      </Badge>
                    </div>
                    {(product.is_rental || product.is_rental_only) && (
                      <Badge variant="outline" className="text-xs w-fit">Rental</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {availableProducts.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mb-2 opacity-50" />
                <p>No products found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Cart */}
      <Card className="w-full lg:w-[420px] flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5" />
            Cart
            {cart.length > 0 && (
              <Badge variant="secondary" className="ml-auto">{cart.length} items</Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden p-4 pt-0">
          {/* Customer Selection */}
          <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="justify-between w-full">
                {selectedCustomerData ? (
                  <span className="flex items-center gap-2 truncate">
                    <User className="h-4 w-4 shrink-0" />
                    {selectedCustomerData.name || selectedCustomerData.company}
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    Select Customer
                  </span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search customers..." value={customerSearchValue} onValueChange={setCustomerSearchValue} />
                <CommandList>
                  <CommandEmpty>No customers found.</CommandEmpty>
                  <CommandGroup>
                    {customers
                      .filter(c =>
                        (c.name || '').toLowerCase().includes(customerSearchValue.toLowerCase()) ||
                        (c.company || '').toLowerCase().includes(customerSearchValue.toLowerCase()) ||
                        (c.email || '').toLowerCase().includes(customerSearchValue.toLowerCase())
                      )
                      .map(customer => (
                        <CommandItem
                          key={customer.id}
                          value={customer.name || customer.company || customer.id}
                          onSelect={() => {
                            setSelectedCustomer(customer.id);
                            setCustomerSearchOpen(false);
                            setCustomerSearchValue("");
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedCustomer === customer.id ? "opacity-100" : "opacity-0")} />
                          <div>
                            <p className="text-sm font-medium">{customer.name || customer.company}</p>
                            {customer.company && customer.name && (
                              <p className="text-xs text-muted-foreground">{customer.company}</p>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Promotion */}
          {promotions.filter(p => p.is_active).length > 0 && (
            <Select value={selectedPromotion} onValueChange={handleApplyPromotion}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Apply Promotion (optional)" />
              </SelectTrigger>
              <SelectContent>
                {promotions.filter(p => p.is_active).map(promo => (
                  <SelectItem key={promo.id} value={promo.id}>{promo.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Separator />

          {/* Cart Items */}
          <ScrollArea className="flex-1 -mx-1 px-1">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ShoppingCart className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs">Click a product to add it</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, index) => (
                  <div key={index} className="flex flex-col gap-2 p-3 rounded-lg border bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">${item.unitPrice.toFixed(2)} each</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeFromCart(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQuantity(index, item.quantity - 1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateCartQuantity(index, parseInt(e.target.value) || 1)}
                          className="h-7 w-14 text-center text-sm"
                          min={1}
                        />
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateCartQuantity(index, item.quantity + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-bold">${getItemTotal(item).toFixed(2)}</span>
                    </div>
                    {/* Rental payment term selector */}
                    {item.isRental && item.paymentTerms && item.paymentTerms.length > 0 && (
                      <Select value={item.paymentTerm} onValueChange={(v) => handlePaymentTermChange(index, v as PaymentTerm)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Payment Term" />
                        </SelectTrigger>
                        <SelectContent>
                          {item.paymentTerms.map(term => (
                            <SelectItem key={term.id} value={term.payment_term}>
                              {PAYMENT_TERM_LABELS[term.payment_term as PaymentTerm] || term.payment_term} - ${term.rental_price.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Cart Summary */}
          {cart.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>${cartSubtotal.toFixed(2)}</span>
              </div>
              {getPromotionDiscount() > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Promotion Discount</span>
                  <span>-${getPromotionDiscount().toFixed(2)}</span>
                </div>
              )}
              {selectedCustomerData?.vatable !== false && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>VAT (12.5%)</span>
                  <span>${(grandTotal * 0.125).toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${(grandTotal + (selectedCustomerData?.vatable !== false ? grandTotal * 0.125 : 0)).toFixed(2)}</span>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={clearCart}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={isSubmitting || cart.length === 0 || !selectedCustomer}
                >
                  <Receipt className="h-4 w-4 mr-1" />
                  {isSubmitting ? "Processing..." : "Checkout"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Complete sale of <strong>${(grandTotal + (selectedCustomerData?.vatable !== false ? grandTotal * 0.125 : 0)).toFixed(2)}</strong> to{" "}
              <strong>{selectedCustomerData?.name || selectedCustomerData?.company}</strong> with {cart.length} item(s)?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCheckout}>Confirm Sale</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
