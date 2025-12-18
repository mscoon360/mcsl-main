import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Edit, Trash2, Calculator, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { useRentalCosts, RentalCostItem, RentalProductCost, CostCategory } from "@/hooks/useRentalCosts";
import { useAuth } from "@/contexts/AuthContext";

const CATEGORIES = [
  { value: 'labour', label: 'Labour/Wages' },
  { value: 'nis', label: 'NIS Company Portion' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'supplies', label: 'Cleaning Supplies' },
  { value: 'contingency', label: 'Contingency' },
  { value: 'other', label: 'Other' },
] as const;

export default function RentalCosting() {
  const { products } = useProducts();
  const { rentalCosts, loading, createRentalCost, updateRentalCost, deleteRentalCost, addCostItem, updateCostItem, deleteCostItem, getRentalCostByProductId } = useRentalCosts();
  const { user } = useAuth();
  
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [currentCost, setCurrentCost] = useState<RentalProductCost | null>(null);
  
  // Dialog states
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RentalCostItem | null>(null);
  
  // Form states
  const [summaryForm, setSummaryForm] = useState({
    unit_cost: 0,
    refill_cost: 0,
    battery_cost: 0,
    battery_frequency_months: 12,
    indirect_cost_percentage: 12.5,
    notes: "",
    prepared_by: ""
  });

  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'bi-monthly' | 'bi-annually' | 'yearly'>('yearly');

  // Period multipliers for cost calculations
  const periodMultipliers = {
    'monthly': 1,
    'bi-monthly': 2,
    'bi-annually': 6,
    'yearly': 12
  };

  const periodLabels = {
    'monthly': 'Monthly',
    'bi-monthly': 'Bi-Monthly',
    'bi-annually': 'Bi-Annually',
    'yearly': 'Yearly'
  };
  
  const [itemForm, setItemForm] = useState<{
    category: CostCategory;
    name: string;
    description: string;
    quantity: number;
    unit_cost: number;
    usage_rate: string;
    monthly_cost: number;
    annual_cost: number;
  }>({
    category: 'labour',
    name: "",
    description: "",
    quantity: 1,
    unit_cost: 0,
    usage_rate: "",
    monthly_cost: 0,
    annual_cost: 0
  });

  // Filter products that can be rental (has rental_price or is_rental)
  const rentalProducts = useMemo(() => 
    products.filter(p => p.is_rental || p.rental_price || p.needs_servicing),
    [products]
  );

  // Get selected product
  const selectedProduct = useMemo(() => 
    products.find(p => p.id === selectedProductId),
    [products, selectedProductId]
  );

  // Load cost when product is selected
  useEffect(() => {
    const loadCost = async () => {
      if (selectedProductId) {
        const cost = await getRentalCostByProductId(selectedProductId);
        setCurrentCost(cost);
        if (cost) {
          setSummaryForm({
            unit_cost: cost.unit_cost || 0,
            refill_cost: cost.refill_cost || 0,
            battery_cost: cost.battery_cost || 0,
            battery_frequency_months: cost.battery_frequency_months || 12,
            indirect_cost_percentage: cost.indirect_cost_percentage || 12.5,
            notes: cost.notes || "",
            prepared_by: cost.prepared_by || ""
          });
        }
      } else {
        setCurrentCost(null);
      }
    };
    loadCost();
  }, [selectedProductId, rentalCosts]);

  // Calculate totals with period support
  // IMPORTANT (per costing PDF): the summary sheet totals are YEARLY, but many line items are entered as monthly-equivalent figures.
  // The yearly total in the summary is computed directly from:
  //   unit_cost (yearly) + refill_cost (entered as "monthly" but used directly) + batteryMonthly + directExpensesMonthly, then indirect %.
  const calculations = useMemo(() => {
    if (!currentCost) return null;

    const periodMultiplier = periodMultipliers[selectedPeriod];

    const items = currentCost.items || [];
    const directExpensesMonthly = items.reduce((sum, item) => sum + (item.monthly_cost || 0), 0);

    // From summary fields
    const batteryMonthly = (summaryForm.battery_cost || 0) / (summaryForm.battery_frequency_months || 12);

    // Base (YEARLY) totals to match the PDF summary sheet
    const unitCostYearly = summaryForm.unit_cost;
    const refillUsedInSummary = summaryForm.refill_cost;

    const subtotalYearly = unitCostYearly + refillUsedInSummary + batteryMonthly;
    const totalDirectCostsYearly = subtotalYearly + directExpensesMonthly;
    const indirectCostsYearly = totalDirectCostsYearly * (summaryForm.indirect_cost_percentage / 100);
    const totalCostYearly = totalDirectCostsYearly + indirectCostsYearly;

    // Convert yearly total to selected period
    const scaleFactor = periodMultiplier / 12;

    const unitCostForPeriod = unitCostYearly * scaleFactor;
    const refillForPeriod = refillUsedInSummary * scaleFactor;
    const batteryForPeriod = batteryMonthly * scaleFactor;
    const directExpensesTotal = directExpensesMonthly * scaleFactor;
    const subtotal = subtotalYearly * scaleFactor;
    const totalDirectCosts = totalDirectCostsYearly * scaleFactor;
    const indirectCosts = indirectCostsYearly * scaleFactor;
    const totalCost = totalCostYearly * scaleFactor;

    // Price: rental_price is monthly
    const monthlyRentalPrice = selectedProduct?.rental_price || selectedProduct?.price || 0;
    const currentPrice = monthlyRentalPrice * periodMultiplier;

    const netDifference = currentPrice - totalCost;
    const marginPercentage = currentPrice > 0 ? ((netDifference / currentPrice) * 100) : 0;

    return {
      directExpensesTotal,
      batteryForPeriod,
      refillForPeriod,
      unitCostForPeriod,
      subtotal,
      totalDirectCosts,
      indirectCosts,
      totalCost,
      currentPrice,
      netDifference,
      marginPercentage,
      periodLabel: periodLabels[selectedPeriod],
      periodMultiplier,
    };
  }, [currentCost, summaryForm, selectedProduct, selectedPeriod]);

  // Group items by category
  const itemsByCategory = useMemo(() => {
    if (!currentCost?.items) return {};
    return currentCost.items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, RentalCostItem[]>);
  }, [currentCost]);

  const handleSetupCosting = async () => {
    if (!selectedProductId) return;
    
    const result = await createRentalCost({
      product_id: selectedProductId,
      ...summaryForm,
      approved_at: null,
      approved_by: null
    });
    
    if (result) {
      setIsSetupDialogOpen(false);
    }
  };

  const handleUpdateSummary = async () => {
    if (!currentCost) return;
    await updateRentalCost(currentCost.id, summaryForm);
  };

  const handleAddItem = async () => {
    if (!currentCost) return;
    
    await addCostItem({
      rental_cost_id: currentCost.id,
      ...itemForm
    });
    
    setIsItemDialogOpen(false);
    resetItemForm();
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    
    await updateCostItem(editingItem.id, itemForm);
    setIsItemDialogOpen(false);
    setEditingItem(null);
    resetItemForm();
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      await deleteCostItem(id);
    }
  };

  const openEditItem = (item: RentalCostItem) => {
    setEditingItem(item);
    setItemForm({
      category: item.category,
      name: item.name,
      description: item.description || "",
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      usage_rate: item.usage_rate || "",
      monthly_cost: item.monthly_cost,
      annual_cost: item.annual_cost
    });
    setIsItemDialogOpen(true);
  };

  const resetItemForm = () => {
    setItemForm({
      category: 'labour',
      name: "",
      description: "",
      quantity: 1,
      unit_cost: 0,
      usage_rate: "",
      monthly_cost: 0,
      annual_cost: 0
    });
  };

  // Auto-calculate annual cost when monthly changes
  useEffect(() => {
    setItemForm(prev => ({
      ...prev,
      annual_cost: prev.monthly_cost * 12
    }));
  }, [itemForm.monthly_cost]);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rental Product Costing</h1>
          <p className="text-muted-foreground">Manage expenses and costing for rental products</p>
        </div>
      </div>

      {/* Product Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Select Rental Product
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a rental product..." />
                </SelectTrigger>
                <SelectContent>
                  {rentalProducts.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - ${product.rental_price || product.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProductId && !currentCost && (
              <Button onClick={() => setIsSetupDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Setup Costing
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Costing Summary */}
      {currentCost && calculations && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Summary Card */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Cost Summary
                    </CardTitle>
                    <CardDescription>
                      {selectedProduct?.name}
                    </CardDescription>
                  </div>
                </div>
                {/* Period Selector */}
                <div className="pt-2">
                  <Select value={selectedPeriod} onValueChange={(v: any) => setSelectedPeriod(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="bi-monthly">Bi-Monthly</SelectItem>
                      <SelectItem value="bi-annually">Bi-Annually</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Unit Cost ({calculations.periodLabel}):</span>
                    <span className="font-medium">${calculations.unitCostForPeriod.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>+ Refill Cost ({calculations.periodLabel}):</span>
                    <span className="font-medium">${calculations.refillForPeriod.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>+ Battery Cost ({calculations.periodLabel}):</span>
                    <span className="font-medium">${calculations.batteryForPeriod.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span>= Subtotal:</span>
                    <span className="font-medium">${calculations.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>+ Direct Expenses:</span>
                    <span className="font-medium">${calculations.directExpensesTotal.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total Direct Costs:</span>
                    <span>${calculations.totalDirectCosts.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>+ Indirect Costs ({summaryForm.indirect_cost_percentage}%):</span>
                    <span className="font-medium">${calculations.indirectCosts.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>TOTAL COST:</span>
                    <span className="text-primary">${calculations.totalCost.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{calculations.periodLabel} Price:</span>
                    <span className="font-medium">${calculations.currentPrice.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between font-bold ${calculations.netDifference >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    <span>Net Difference:</span>
                    <span>${calculations.netDifference.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Margin:</span>
                    <Badge variant={calculations.marginPercentage >= 20 ? "default" : "destructive"}>
                      {calculations.marginPercentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Unit Cost ($)</Label>
                    <Input
                      type="number"
                      value={summaryForm.unit_cost}
                      onChange={e => setSummaryForm(prev => ({ ...prev, unit_cost: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Refill Cost (Monthly) ($)</Label>
                    <Input
                      type="number"
                      value={summaryForm.refill_cost}
                      onChange={e => setSummaryForm(prev => ({ ...prev, refill_cost: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Battery Cost ($)</Label>
                      <Input
                        type="number"
                        value={summaryForm.battery_cost}
                        onChange={e => setSummaryForm(prev => ({ ...prev, battery_cost: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Frequency (Months)</Label>
                      <Input
                        type="number"
                        value={summaryForm.battery_frequency_months}
                        onChange={e => setSummaryForm(prev => ({ ...prev, battery_frequency_months: parseInt(e.target.value) || 12 }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Indirect Cost (%)</Label>
                    <Input
                      type="number"
                      value={summaryForm.indirect_cost_percentage}
                      onChange={e => setSummaryForm(prev => ({ ...prev, indirect_cost_percentage: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <Button onClick={handleUpdateSummary} className="w-full">
                    Update Summary
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Expense Items */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Direct Expense Items</CardTitle>
                  <CardDescription>Itemized expenses for this rental product</CardDescription>
                </div>
                <Button onClick={() => { resetItemForm(); setEditingItem(null); setIsItemDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent>
                {CATEGORIES.map(category => {
                  const items = itemsByCategory[category.value] || [];
                  if (items.length === 0) return null;
                  
                  const categoryTotal = items.reduce((sum, item) => sum + item.monthly_cost, 0);
                  
                  return (
                    <div key={category.value} className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm uppercase text-muted-foreground">{category.label}</h3>
                        <span className="text-sm font-medium">${categoryTotal.toFixed(2)}/mo</span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Unit Cost</TableHead>
                            <TableHead>Usage Rate</TableHead>
                            <TableHead className="text-right">Monthly</TableHead>
                            <TableHead className="text-right">Annual</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map(item => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>${item.unit_cost.toFixed(2)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{item.usage_rate || '-'}</TableCell>
                              <TableCell className="text-right">${item.monthly_cost.toFixed(2)}</TableCell>
                              <TableCell className="text-right">${item.annual_cost.toFixed(2)}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEditItem(item)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}

                {Object.keys(itemsByCategory).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No expense items added yet.</p>
                    <p className="text-sm">Click "Add Item" to add expense line items.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Setup Dialog */}
      <Dialog open={isSetupDialogOpen} onOpenChange={setIsSetupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Setup Rental Product Costing</DialogTitle>
            <DialogDescription>
              Configure the base costing for {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Unit Cost ($)</Label>
              <Input
                type="number"
                value={summaryForm.unit_cost}
                onChange={e => setSummaryForm(prev => ({ ...prev, unit_cost: parseFloat(e.target.value) || 0 }))}
                placeholder={selectedProduct?.cost_price?.toString() || "0"}
              />
            </div>
            <div className="space-y-2">
              <Label>Refill Cost (Monthly) ($)</Label>
              <Input
                type="number"
                value={summaryForm.refill_cost}
                onChange={e => setSummaryForm(prev => ({ ...prev, refill_cost: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Battery Cost ($)</Label>
                <Input
                  type="number"
                  value={summaryForm.battery_cost}
                  onChange={e => setSummaryForm(prev => ({ ...prev, battery_cost: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Battery Frequency (Months)</Label>
                <Input
                  type="number"
                  value={summaryForm.battery_frequency_months}
                  onChange={e => setSummaryForm(prev => ({ ...prev, battery_frequency_months: parseInt(e.target.value) || 12 }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Indirect Cost Percentage (%)</Label>
              <Input
                type="number"
                value={summaryForm.indirect_cost_percentage}
                onChange={e => setSummaryForm(prev => ({ ...prev, indirect_cost_percentage: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Prepared By</Label>
              <Input
                value={summaryForm.prepared_by}
                onChange={e => setSummaryForm(prev => ({ ...prev, prepared_by: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={summaryForm.notes}
                onChange={e => setSummaryForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSetupDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSetupCosting}>Create Costing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit" : "Add"} Expense Item</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the expense item details" : "Add a new expense line item"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={itemForm.category} onValueChange={(v: any) => setItemForm(prev => ({ ...prev, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={itemForm.name}
                onChange={e => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Hyg. Tech/Driver, Insurance, Disp. Gloves"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                value={itemForm.description}
                onChange={e => setItemForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={itemForm.quantity}
                  onChange={e => setItemForm(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Cost ($)</Label>
                <Input
                  type="number"
                  value={itemForm.unit_cost}
                  onChange={e => setItemForm(prev => ({ ...prev, unit_cost: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Usage Rate (Optional)</Label>
              <Input
                value={itemForm.usage_rate}
                onChange={e => setItemForm(prev => ({ ...prev, usage_rate: e.target.value }))}
                placeholder="e.g., 50per bx @ $30.00, 1 per ser."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monthly Cost ($)</Label>
                <Input
                  type="number"
                  value={itemForm.monthly_cost}
                  onChange={e => setItemForm(prev => ({ ...prev, monthly_cost: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Annual Cost ($)</Label>
                <Input
                  type="number"
                  value={itemForm.annual_cost}
                  onChange={e => setItemForm(prev => ({ ...prev, annual_cost: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsItemDialogOpen(false); setEditingItem(null); resetItemForm(); }}>Cancel</Button>
            <Button onClick={editingItem ? handleUpdateItem : handleAddItem}>
              {editingItem ? "Update" : "Add"} Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
