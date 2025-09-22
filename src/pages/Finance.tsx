import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, DollarSign, TrendingUp, TrendingDown, Calendar, Receipt, Building, Wrench, Trash2 } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths, isWithinInterval, parseISO } from "date-fns";

interface Expenditure {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: 'working-capital' | 'fixed-capital';
  type: string; // More specific type like 'materials', 'equipment', etc.
}

interface MonthlyFinancials {
  month: string;
  salesIncome: number;
  rentalIncome: number;
  collectionIncome: number;
  totalIncome: number;
  workingCapitalExpenses: number;
  fixedCapitalExpenses: number;
  totalExpenses: number;
  netIncome: number;
}

export default function Finance() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [newExpense, setNewExpense] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    amount: 0,
    category: 'working-capital' as 'working-capital' | 'fixed-capital',
    type: ''
  });

  // Get data from localStorage
  const [sales] = useLocalStorage<Array<{
    id: string;
    customer: string;
    total: number;
    items: Array<{
      product: string;
      quantity: number;
      price: number;
      isRental?: boolean;
      contractLength?: string;
      paymentPeriod?: string;
      startDate?: Date;
      endDate?: Date;
    }>;
    date: string;
    status: string;
  }>>('dashboard-sales', []);

  // Get paid payments from localStorage for finance calculations
  const [paidPayments] = useLocalStorage<Array<{
    id: string;
    customer: string;
    product: string;
    amount: number;
    dueDate: string;
    paidDate: string;
    paymentMethod: string;
    status: 'paid';
  }>>('paid-rental-payments', []);

  const [expenditures, setExpenditures] = useLocalStorage<Expenditure[]>('finance-expenditures', []);

  // Generate list of months for the dropdown (12 months back, current, 12 months forward)
  const generateMonthOptions = () => {
    const currentDate = new Date();
    const startDate = subMonths(currentDate, 12);
    const endDate = addMonths(currentDate, 12);
    
    return eachMonthOfInterval({
      start: startDate,
      end: endDate
    }).map(date => ({
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy')
    }));
  };

  const calculateMonthlyFinancials = (month: string): MonthlyFinancials => {
    const monthStart = startOfMonth(parseISO(`${month}-01`));
    const monthEnd = endOfMonth(parseISO(`${month}-01`));

    // Calculate sales income (all one-time sales in the month, excluding rental agreements)
    const salesIncome = sales
      .filter(sale => {
        const saleDate = parseISO(sale.date);
        return isWithinInterval(saleDate, { start: monthStart, end: monthEnd }) &&
               !sale.items.some(item => item.isRental); // Only count non-rental sales
      })
      .reduce((sum, sale) => sum + sale.total, 0);

    // Calculate collection income (actual payments received from rental contracts in the month)
    const collectionIncome = paidPayments
      .filter(payment => {
        const paymentDate = parseISO(payment.paidDate); // Use actual paid date
        return isWithinInterval(paymentDate, { start: monthStart, end: monthEnd });
      })
      .reduce((sum, payment) => sum + payment.amount, 0);

    // Rental income is now tracked through actual collections, not theoretical recurring amounts
    const rentalIncome = 0;

    // Calculate expenses for the month
    const monthExpenses = expenditures.filter(expense => {
      const expenseDate = parseISO(expense.date);
      return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
    });

    const workingCapitalExpenses = monthExpenses
      .filter(expense => expense.category === 'working-capital')
      .reduce((sum, expense) => sum + expense.amount, 0);

    const fixedCapitalExpenses = monthExpenses
      .filter(expense => expense.category === 'fixed-capital')
      .reduce((sum, expense) => sum + expense.amount, 0);

    const totalIncome = salesIncome + collectionIncome;
    const totalExpenses = workingCapitalExpenses + fixedCapitalExpenses;
    const netIncome = totalIncome - totalExpenses;

    return {
      month,
      salesIncome,
      rentalIncome,
      collectionIncome,
      totalIncome,
      workingCapitalExpenses,
      fixedCapitalExpenses,
      totalExpenses,
      netIncome
    };
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newExpense.description || !newExpense.amount || !newExpense.type) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    const expense: Expenditure = {
      id: Date.now().toString(),
      ...newExpense
    };

    setExpenditures(prev => [...prev, expense]);
    
    toast({
      title: "Expense Added",
      description: `${expense.category === 'working-capital' ? 'Working' : 'Fixed'} capital expense of $${expense.amount.toFixed(2)} has been recorded.`
    });

    // Reset form
    setNewExpense({
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      amount: 0,
      category: 'working-capital',
      type: ''
    });
    setShowExpenseForm(false);
  };

  const handleDeleteExpense = (expenseId: string) => {
    const expense = expenditures.find(e => e.id === expenseId);
    if (!expense) return;

    setExpenditures(prev => prev.filter(e => e.id !== expenseId));
    
    toast({
      title: "Expense Deleted",
      description: `Expense of $${expense.amount.toFixed(2)} has been removed.`
    });
  };

  const monthlyData = calculateMonthlyFinancials(selectedMonth);
  const monthOptions = generateMonthOptions();

  // Get expenses for selected month for detailed view
  const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
  const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));
  const monthExpenses = expenditures.filter(expense => {
    const expenseDate = parseISO(expense.date);
    return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Finance Dashboard</h1>
          <p className="text-muted-foreground">Track income and expenses across all revenue streams</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowExpenseForm(!showExpenseForm)}>
            <Plus className="h-4 w-4 mr-2" />
            {showExpenseForm ? "Cancel" : "Add Expense"}
          </Button>
        </div>
      </div>

      {/* Add Expense Form */}
      {showExpenseForm && (
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Add New Expense</CardTitle>
            <CardDescription>
              Record a new working capital or fixed capital expense.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense(prev => ({...prev, date: e.target.value}))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    type="text"
                    placeholder="0.00"
                    value={newExpense.amount === 0 ? '' : newExpense.amount.toString()}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setNewExpense(prev => ({...prev, amount: value === '' ? 0 : parseFloat(value) || 0}));
                      }
                    }}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select 
                    value={newExpense.category} 
                    onValueChange={(value: 'working-capital' | 'fixed-capital') => 
                      setNewExpense(prev => ({...prev, category: value}))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="working-capital">Working Capital</SelectItem>
                      <SelectItem value="fixed-capital">Fixed Capital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select 
                    value={newExpense.type} 
                    onValueChange={(value) => setNewExpense(prev => ({...prev, type: value}))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select expense type" />
                    </SelectTrigger>
                    <SelectContent>
                      {newExpense.category === 'working-capital' ? (
                        <>
                          <SelectItem value="materials">Raw Materials</SelectItem>
                          <SelectItem value="utilities">Utilities</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="supplies">Office Supplies</SelectItem>
                          <SelectItem value="fuel">Fuel & Transportation</SelectItem>
                          <SelectItem value="other-working">Other Working Capital</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="equipment">Equipment</SelectItem>
                          <SelectItem value="machinery">Machinery</SelectItem>
                          <SelectItem value="vehicles">Vehicles</SelectItem>
                          <SelectItem value="property">Property & Buildings</SelectItem>
                          <SelectItem value="technology">Technology & Software</SelectItem>
                          <SelectItem value="other-fixed">Other Fixed Capital</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  value={newExpense.description}
                  onChange={(e) => setNewExpense(prev => ({...prev, description: e.target.value}))}
                  placeholder="Describe the expense..."
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                Add Expense
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Monthly Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">${monthlyData.totalIncome.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              For {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${monthlyData.totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              For {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Net Income</CardTitle>
            <DollarSign className={`h-4 w-4 ${monthlyData.netIncome >= 0 ? 'text-success' : 'text-destructive'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthlyData.netIncome >= 0 ? 'text-success' : 'text-destructive'}`}>
              ${monthlyData.netIncome.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {monthlyData.netIncome >= 0 ? 'Profit' : 'Loss'} for {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Profit Margin</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthlyData.netIncome >= 0 ? 'text-success' : 'text-destructive'}`}>
              {monthlyData.totalIncome > 0 ? ((monthlyData.netIncome / monthlyData.totalIncome) * 100).toFixed(1) : '0.0'}%
            </div>
            <p className="text-xs text-muted-foreground">
              Net margin for {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Income Breakdown */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Income Breakdown</CardTitle>
          <CardDescription>
            Revenue streams for {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Sales Income</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">${monthlyData.salesIncome.toFixed(2)}</div>
              <p className="text-sm text-muted-foreground">One-time product sales</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-green-500" />
                <span className="font-medium">Contract Collections</span>
              </div>
              <div className="text-2xl font-bold text-green-600">${monthlyData.collectionIncome.toFixed(2)}</div>
              <p className="text-sm text-muted-foreground">Rental payments received</p>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Expenses Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Expense Summary</CardTitle>
            <CardDescription>
              Costs for {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-orange-600" />
                  <span className="font-medium">Working Capital</span>
                </div>
                <div className="text-lg font-bold text-orange-600">
                  ${monthlyData.workingCapitalExpenses.toFixed(2)}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-red-600" />
                  <span className="font-medium">Fixed Capital</span>
                </div>
                <div className="text-lg font-bold text-red-600">
                  ${monthlyData.fixedCapitalExpenses.toFixed(2)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Expenses Detail */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Monthly Expenses Detail</CardTitle>
            <CardDescription>
              {monthExpenses.length} expense{monthExpenses.length !== 1 ? 's' : ''} recorded
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthExpenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No expenses recorded for this month</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {monthExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex-1">
                      <div className="font-medium">{expense.description}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {expense.category === 'working-capital' ? 'Working' : 'Fixed'} Capital
                        </Badge>
                        <span>{expense.type}</span>
                        <span>•</span>
                        <span>{format(parseISO(expense.date), 'MMM dd')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-destructive">
                        ${expense.amount.toFixed(2)}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}