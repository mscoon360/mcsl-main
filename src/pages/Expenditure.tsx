import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Building, Wrench, Trash2, Calendar, DollarSign, Filter, TrendingDown, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isWithinInterval, parseISO } from "date-fns";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { useExpenditures } from "@/hooks/useExpenditures";

interface Expenditure {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: 'working-capital' | 'fixed-capital';
  type: string;
}

export default function Expenditure() {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'working-capital' | 'fixed-capital' | 'payroll' | 'tax'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'category'>('date');

  // Check access permissions
  useEffect(() => {
    const checkAccess = async () => {
      if (!user || isAdmin) return;
      
      const { data } = await supabase
        .from('department_visibility')
        .select('department')
        .eq('user_id', user.id);
      
      const allowedSections = data?.map(d => d.department) || [];
      const hasAccess = allowedSections.includes('Finance-Expenditure') || allowedSections.includes('Finance');
      
      if (!hasAccess && allowedSections.length > 0) {
        navigate('/');
      }
    };
    checkAccess();
  }, [user, isAdmin, navigate]);
  const [newExpense, setNewExpense] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    amount: 0,
    category: 'working-capital' as 'working-capital' | 'fixed-capital',
    type: ''
  });

  const { expenditures, addExpense, deleteExpense } = useExpenditures();

  // Generate month options
  const generateMonthOptions = () => {
    const currentDate = new Date();
    const startDate = subMonths(currentDate, 12);
    
    return eachMonthOfInterval({
      start: startDate,
      end: currentDate
    }).map(date => ({
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy')
    }));
  };

  const monthOptions = generateMonthOptions();

  // Get expenses for selected month
  const getMonthExpenses = () => {
    const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
    const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));
    
    return expenditures.filter(expense => {
      const expenseDate = parseISO(expense.date);
      const matchesMonth = isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
      
      let matchesCategory = true;
      switch (categoryFilter) {
        case 'all':
          matchesCategory = true;
          break;
        case 'working-capital':
          matchesCategory = expense.category === 'working-capital';
          break;
        case 'fixed-capital':
          matchesCategory = expense.category === 'fixed-capital';
          break;
        case 'payroll':
          matchesCategory = expense.type === 'payroll';
          break;
        case 'tax':
          matchesCategory = expense.type === 'tax';
          break;
      }
      
      return matchesMonth && matchesCategory;
    });
  };

  const monthExpenses = getMonthExpenses();

  // Sort expenses
  const sortedExpenses = [...monthExpenses].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      case 'amount':
        return b.amount - a.amount;
      case 'category':
        return a.category.localeCompare(b.category);
      default:
        return 0;
    }
  });

  // Calculate totals
  const totalExpenses = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const workingCapitalTotal = monthExpenses
    .filter(e => e.category === 'working-capital')
    .reduce((sum, expense) => sum + expense.amount, 0);
  const fixedCapitalTotal = monthExpenses
    .filter(e => e.category === 'fixed-capital')
    .reduce((sum, expense) => sum + expense.amount, 0);
  const payrollTotal = expenditures
    .filter(expense => {
      const expenseDate = parseISO(expense.date);
      const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
      const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));
      return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd }) && expense.type === 'payroll';
    })
    .reduce((sum, expense) => sum + expense.amount, 0);
  const taxTotal = expenditures
    .filter(expense => {
      const expenseDate = parseISO(expense.date);
      const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
      const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));
      return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd }) && expense.type === 'tax';
    })
    .reduce((sum, expense) => sum + expense.amount, 0);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newExpense.description || !newExpense.amount || !newExpense.type) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    await addExpense(newExpense);

    toast({
      title: "Expense Added",
      description: `${newExpense.category === 'working-capital' ? 'Working' : 'Fixed'} capital expense of $${newExpense.amount.toFixed(2)} has been recorded.`
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

  const handleDeleteExpense = async (expenseId: string) => {
    const expense = expenditures.find(e => e.id === expenseId);
    if (!expense) return;

    await deleteExpense(expenseId);

    toast({
      title: "Expense Deleted",
      description: `Expense of $${expense.amount.toFixed(2)} has been removed.`
    });
  };

  const handleExportToExcel = () => {
    // Prepare data for Excel export
    const exportData = sortedExpenses.map(expense => ({
      Date: format(parseISO(expense.date), 'MM/dd/yyyy'),
      Category: expense.category === 'working-capital' ? 'Working Capital' : 'Fixed Capital',
      Type: expense.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      Description: expense.description,
      Amount: expense.amount
    }));

    // Add summary row
    const summaryData = [
      { Date: '', Category: '', Type: '', Description: '', Amount: '' },
      { Date: '', Category: 'SUMMARY', Type: '', Description: '', Amount: '' },
      { Date: '', Category: 'Total Expenses', Type: '', Description: '', Amount: totalExpenses },
      { Date: '', Category: 'Working Capital', Type: '', Description: '', Amount: workingCapitalTotal },
      { Date: '', Category: 'Fixed Capital', Type: '', Description: '', Amount: fixedCapitalTotal },
      { Date: '', Category: 'Payroll', Type: '', Description: '', Amount: payrollTotal },
      { Date: '', Category: 'Tax', Type: '', Description: '', Amount: taxTotal }
    ];

    const finalData = [...exportData, ...summaryData];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(finalData);

    // Set column widths
    ws['!cols'] = [
      { width: 12 }, // Date
      { width: 18 }, // Category
      { width: 20 }, // Type
      { width: 40 }, // Description
      { width: 12 }  // Amount
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');

    // Generate filename with current month
    const filename = `Expenses_${format(parseISO(`${selectedMonth}-01`), 'yyyy_MM')}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);

    toast({
      title: "Excel Export Complete",
      description: `Financial report downloaded as ${filename}`
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Expenditure Management</h1>
          <p className="text-muted-foreground">Track and manage all business expenses</p>
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
          <Button variant="outline" onClick={handleExportToExcel}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
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
                          <SelectItem value="payroll">Payroll & Benefits</SelectItem>
                          <SelectItem value="tax">Tax & Compliance</SelectItem>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Working Capital</CardTitle>
            <Wrench className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-orange-600">${workingCapitalTotal.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {monthExpenses.filter(e => e.category === 'working-capital').length} expenses
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Fixed Capital</CardTitle>
            <Building className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-red-600">${fixedCapitalTotal.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {monthExpenses.filter(e => e.category === 'fixed-capital').length} expenses
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-blue-600">${payrollTotal.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Employee costs
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Tax</CardTitle>
            <Calendar className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-purple-600">${taxTotal.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Compliance costs
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Avg. Expense</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent className="text-center">
            <div className="text-2xl font-bold text-gray-600">
              ${monthExpenses.length > 0 ? (totalExpenses / monthExpenses.length).toFixed(2) : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Total Expenses - Enlarged */}
      <Card className="dashboard-card">
        <CardHeader className="flex flex-row items-center justify-center gap-2 space-y-0 pb-4">
          <CardTitle className="text-lg font-medium text-card-foreground">Total Expenses</CardTitle>
          <TrendingDown className="h-6 w-6 text-destructive" />
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-4xl font-bold text-destructive">${totalExpenses.toFixed(2)}</div>
          <p className="text-sm text-muted-foreground mt-2">
            {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
          </p>
        </CardContent>
      </Card>

      {/* Filters and Controls */}
      <Card className="dashboard-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filter by category:</span>
              </div>
              <Select value={categoryFilter} onValueChange={(value: 'all' | 'working-capital' | 'fixed-capital' | 'payroll' | 'tax') => setCategoryFilter(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="working-capital">Working Capital</SelectItem>
                  <SelectItem value="fixed-capital">Fixed Capital</SelectItem>
                  <SelectItem value="payroll">Payroll Only</SelectItem>
                  <SelectItem value="tax">Tax Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Sort by:</span>
              <Select value={sortBy} onValueChange={(value: 'date' | 'amount' | 'category') => setSortBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="amount">Amount</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses List */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Expense Records</CardTitle>
          <CardDescription>
            {sortedExpenses.length} expense{sortedExpenses.length !== 1 ? 's' : ''} recorded for {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
            {categoryFilter === 'working-capital' && ' - Working Capital only'}
            {categoryFilter === 'fixed-capital' && ' - Fixed Capital only'}
            {categoryFilter === 'payroll' && ' - Payroll expenses only'}
            {categoryFilter === 'tax' && ' - Tax expenses only'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedExpenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No expenses recorded for this period</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(parseISO(expense.date), 'MMM dd, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={expense.category === 'working-capital' ? 'default' : 'secondary'}>
                        {expense.category === 'working-capital' ? 'Working' : 'Fixed'} Capital
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{expense.type.replace('-', ' ')}</TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate">{expense.description}</div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-destructive">
                      ${expense.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}