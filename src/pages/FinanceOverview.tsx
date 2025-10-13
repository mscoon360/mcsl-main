import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, Receipt, Calendar, BarChart3, PieChart, Download, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths, isWithinInterval, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, LineChart, Line, Pie } from "recharts";
import * as XLSX from 'xlsx';
import { useSales } from "@/hooks/useSales";
import { usePaymentSchedules } from "@/hooks/usePaymentSchedules";
import { supabase } from "@/integrations/supabase/client";
import { useExpenditures } from "@/hooks/useExpenditures";
interface MonthlyFinancials {
  month: string;
  salesIncome: number;
  collectionIncome: number;
  totalIncome: number;
  workingCapitalExpenses: number;
  fixedCapitalExpenses: number;
  totalExpenses: number;
  netIncome: number;
}
export default function FinanceOverview() {
  const {
    toast
  } = useToast();
  const {
    user,
    isAdmin
  } = useAuth();
  const navigate = useNavigate();
  const [periodLength, setPeriodLength] = useState<'1' | '3' | '6' | '12'>('1');
  const [periodEndDate, setPeriodEndDate] = useState(new Date());
  const {
    sales: supabaseSales
  } = useSales();
  const {
    paymentSchedules: supabasePaymentSchedules
  } = usePaymentSchedules();
  const {
    expenditures
  } = useExpenditures();

  // Check access permissions
  useEffect(() => {
    const checkAccess = async () => {
      if (!user || isAdmin) return;
      const {
        data
      } = await supabase.from('department_visibility').select('department').eq('user_id', user.id);
      const allowedSections = data?.map(d => d.department) || [];
      const hasAccess = allowedSections.includes('Finance-Overview') || allowedSections.includes('Finance');
      if (!hasAccess && allowedSections.length > 0) {
        navigate('/');
      }
    };
    checkAccess();
  }, [user, isAdmin, navigate]);

  // Map Supabase sales to expected format
  const sales = supabaseSales.map(sale => ({
    id: sale.id,
    customer: sale.customer_name,
    total: sale.total,
    items: sale.items.map(item => ({
      product: item.product_name,
      quantity: item.quantity,
      price: item.price,
      isRental: item.is_rental
    })),
    date: sale.date,
    status: sale.status
  }));

  // Map Supabase payment schedules to expected format
  const paidPayments = supabasePaymentSchedules.filter(p => p.status === 'paid' && p.paid_date).map(p => ({
    id: p.id,
    customer: p.customer,
    product: p.product,
    amount: p.amount,
    dueDate: p.due_date,
    paidDate: p.paid_date!,
    paymentMethod: p.payment_method || 'cash',
    status: 'paid' as const
  }));
  console.log('Finance Overview - Expenditures loaded:', expenditures.length);

  // Calculate period start and end dates
  const periodStart = startOfMonth(subMonths(periodEndDate, parseInt(periodLength) - 1));
  const periodEnd = endOfMonth(periodEndDate);

  // Navigate to previous period
  const handlePreviousPeriod = () => {
    setPeriodEndDate(subMonths(periodEndDate, parseInt(periodLength)));
  };

  // Navigate to next period
  const handleNextPeriod = () => {
    setPeriodEndDate(addMonths(periodEndDate, parseInt(periodLength)));
  };

  // Generate month options for the selector
  const getPeriodLabel = () => {
    if (periodLength === '1') {
      return format(periodEndDate, 'MMMM yyyy');
    } else {
      return `${format(periodStart, 'MMM yyyy')} - ${format(periodEnd, 'MMM yyyy')}`;
    }
  };

  // Calculate financial data for the selected period
  const calculatePeriodFinancials = (): MonthlyFinancials => {
    const salesIncome = sales.filter(sale => {
      const saleDate = parseISO(sale.date);
      return isWithinInterval(saleDate, {
        start: periodStart,
        end: periodEnd
      }) && !sale.items.some(item => item.isRental);
    }).reduce((sum, sale) => sum + sale.total, 0);
    const collectionIncome = paidPayments.filter(payment => {
      const paymentDate = parseISO(payment.paidDate);
      return isWithinInterval(paymentDate, {
        start: periodStart,
        end: periodEnd
      });
    }).reduce((sum, payment) => sum + payment.amount, 0);
    const periodExpenses = expenditures.filter(expense => {
      const expenseDate = parseISO(expense.date);
      return isWithinInterval(expenseDate, {
        start: periodStart,
        end: periodEnd
      });
    });
    const workingCapitalExpenses = periodExpenses.filter(expense => expense.category === 'working-capital' || expense.type === 'supplies').reduce((sum, expense) => sum + expense.amount, 0);
    const fixedCapitalExpenses = periodExpenses.filter(expense => expense.category === 'fixed-capital').reduce((sum, expense) => sum + expense.amount, 0);
    const totalIncome = salesIncome + collectionIncome;
    const totalExpenses = workingCapitalExpenses + fixedCapitalExpenses;
    return {
      month: format(periodEndDate, 'yyyy-MM'),
      salesIncome,
      collectionIncome,
      totalIncome,
      workingCapitalExpenses,
      fixedCapitalExpenses,
      totalExpenses,
      netIncome: totalIncome - totalExpenses
    };
  };

  // Generate data for monthly breakdown chart
  const getPerformanceData = () => {
    const months = eachMonthOfInterval({
      start: periodStart,
      end: periodEnd
    });
    return months.map(date => {
      const monthStr = format(date, 'yyyy-MM');
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const salesIncome = sales.filter(sale => {
        const saleDate = parseISO(sale.date);
        return isWithinInterval(saleDate, {
          start: monthStart,
          end: monthEnd
        }) && !sale.items.some(item => item.isRental);
      }).reduce((sum, sale) => sum + sale.total, 0);
      const collectionIncome = paidPayments.filter(payment => {
        const paymentDate = parseISO(payment.paidDate);
        return isWithinInterval(paymentDate, {
          start: monthStart,
          end: monthEnd
        });
      }).reduce((sum, payment) => sum + payment.amount, 0);
      const monthExpenses = expenditures.filter(expense => {
        const expenseDate = parseISO(expense.date);
        return isWithinInterval(expenseDate, {
          start: monthStart,
          end: monthEnd
        });
      });
      const workingCapitalExpenses = monthExpenses.filter(expense => expense.category === 'working-capital' || expense.type === 'supplies').reduce((sum, expense) => sum + expense.amount, 0);
      const fixedCapitalExpenses = monthExpenses.filter(expense => expense.category === 'fixed-capital').reduce((sum, expense) => sum + expense.amount, 0);
      const totalIncome = salesIncome + collectionIncome;
      const totalExpenses = workingCapitalExpenses + fixedCapitalExpenses;
      return {
        month: format(date, 'MMM yy'),
        income: totalIncome,
        expenses: totalExpenses,
        net: totalIncome - totalExpenses
      };
    });
  };
  const currentPeriodData = calculatePeriodFinancials();
  const performanceData = getPerformanceData();

  // Calculate previous period data for comparison
  const previousPeriodStart = startOfMonth(subMonths(periodStart, parseInt(periodLength)));
  const previousPeriodEnd = endOfMonth(subMonths(periodEnd, parseInt(periodLength)));
  const previousPeriodData = (() => {
    const salesIncome = sales.filter(sale => {
      const saleDate = parseISO(sale.date);
      return isWithinInterval(saleDate, {
        start: previousPeriodStart,
        end: previousPeriodEnd
      }) && !sale.items.some(item => item.isRental);
    }).reduce((sum, sale) => sum + sale.total, 0);
    const collectionIncome = paidPayments.filter(payment => {
      const paymentDate = parseISO(payment.paidDate);
      return isWithinInterval(paymentDate, {
        start: previousPeriodStart,
        end: previousPeriodEnd
      });
    }).reduce((sum, payment) => sum + payment.amount, 0);
    const prevExpenses = expenditures.filter(expense => {
      const expenseDate = parseISO(expense.date);
      return isWithinInterval(expenseDate, {
        start: previousPeriodStart,
        end: previousPeriodEnd
      });
    });
    const workingCapitalExpenses = prevExpenses.filter(expense => expense.category === 'working-capital' || expense.type === 'supplies').reduce((sum, expense) => sum + expense.amount, 0);
    const fixedCapitalExpenses = prevExpenses.filter(expense => expense.category === 'fixed-capital').reduce((sum, expense) => sum + expense.amount, 0);
    const totalIncome = salesIncome + collectionIncome;
    const totalExpenses = workingCapitalExpenses + fixedCapitalExpenses;
    return {
      totalIncome,
      totalExpenses,
      netIncome: totalIncome - totalExpenses
    };
  })();
  console.log('Current period data:', currentPeriodData);
  console.log('Expenses for current period:', currentPeriodData.totalExpenses);

  // Calculate period-over-period changes
  const incomeChange = currentPeriodData.totalIncome - previousPeriodData.totalIncome;
  const incomePercentage = previousPeriodData.totalIncome > 0 ? incomeChange / previousPeriodData.totalIncome * 100 : 0;
  const expenseChange = currentPeriodData.totalExpenses - previousPeriodData.totalExpenses;
  const expensePercentage = previousPeriodData.totalExpenses > 0 ? expenseChange / previousPeriodData.totalExpenses * 100 : 0;
  const netChange = currentPeriodData.netIncome - previousPeriodData.netIncome;
  const netPercentage = previousPeriodData.netIncome !== 0 ? netChange / Math.abs(previousPeriodData.netIncome) * 100 : 0;

  // Calculate totals for current period
  const periodTotals = performanceData.reduce((acc, month) => ({
    income: acc.income + month.income,
    expenses: acc.expenses + month.expenses,
    net: acc.net + month.net
  }), {
    income: 0,
    expenses: 0,
    net: 0
  });

  // Pie chart data for income breakdown
  const incomeBreakdown = [{
    name: 'Sales',
    value: currentPeriodData.salesIncome,
    color: '#3b82f6'
  }, {
    name: 'Collections',
    value: currentPeriodData.collectionIncome,
    color: '#10b981'
  }].filter(item => item.value > 0);

  // Pie chart data for expense breakdown
  const expenseBreakdown = [{
    name: 'Working Capital',
    value: currentPeriodData.workingCapitalExpenses,
    color: '#f59e0b'
  }, {
    name: 'Fixed Capital',
    value: currentPeriodData.fixedCapitalExpenses,
    color: '#ef4444'
  }].filter(item => item.value > 0);
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
  const handleExportFinancialReport = () => {
    try {
      // Prepare performance data for Excel
      const performanceExport = performanceData.map(month => ({
        Month: month.month,
        Income: Number(month.income.toFixed(2)),
        Expenses: Number(month.expenses.toFixed(2)),
        'Net Profit': Number(month.net.toFixed(2))
      }));

      // Prepare summary data
      const summaryData = [{
        Month: '',
        Income: '',
        Expenses: '',
        'Net Profit': ''
      }, {
        Month: 'SUMMARY',
        Income: '',
        Expenses: '',
        'Net Profit': ''
      }, {
        Month: 'Total Income',
        Income: Number(periodTotals.income.toFixed(2)),
        Expenses: '',
        'Net Profit': ''
      }, {
        Month: 'Total Expenses',
        Income: '',
        Expenses: Number(periodTotals.expenses.toFixed(2)),
        'Net Profit': ''
      }, {
        Month: 'Net Profit/Loss',
        Income: '',
        Expenses: '',
        'Net Profit': Number(periodTotals.net.toFixed(2))
      }, {
        Month: '',
        Income: '',
        Expenses: '',
        'Net Profit': ''
      }, {
        Month: 'Current Period Breakdown',
        Income: '',
        Expenses: '',
        'Net Profit': ''
      }, {
        Month: 'Sales Income',
        Income: Number(currentPeriodData.salesIncome.toFixed(2)),
        Expenses: '',
        'Net Profit': ''
      }, {
        Month: 'Collection Income',
        Income: Number(currentPeriodData.collectionIncome.toFixed(2)),
        Expenses: '',
        'Net Profit': ''
      }, {
        Month: 'Working Capital Expenses',
        Income: '',
        Expenses: Number(currentPeriodData.workingCapitalExpenses.toFixed(2)),
        'Net Profit': ''
      }, {
        Month: 'Fixed Capital Expenses',
        Income: '',
        Expenses: Number(currentPeriodData.fixedCapitalExpenses.toFixed(2)),
        'Net Profit': ''
      }];
      const finalData = [...performanceExport, ...summaryData];
      if (finalData.length === 0) {
        toast({
          title: "Export Error",
          description: "No data available to export",
          variant: "destructive"
        });
        return;
      }

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(finalData);

      // Set column widths
      ws['!cols'] = [{
        width: 25
      },
      // Month
      {
        width: 15
      },
      // Income
      {
        width: 15
      },
      // Expenses
      {
        width: 15
      } // Net Profit
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Financial Overview');

      // Generate filename
      const periodLabel = `${periodLength}month${periodLength !== '1' ? 's' : ''}_${format(periodStart, 'MMM_yy')}_to_${format(periodEnd, 'MMM_yy')}`;
      const filename = `Financial_Overview_${periodLabel}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      toast({
        title: "Financial Report Exported",
        description: `Complete financial overview downloaded as ${filename}`
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting the financial report",
        variant: "destructive"
      });
    }
  };
  return <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Finance Overview</h1>
          <p className="text-muted-foreground">Comprehensive financial analysis and insights</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={periodLength} onValueChange={(value: any) => setPeriodLength(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Month</SelectItem>
              <SelectItem value="3">3 Months</SelectItem>
              <SelectItem value="6">6 Months</SelectItem>
              <SelectItem value="12">12 Months</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 border rounded-md px-3 py-2">
            <Button variant="ghost" size="icon" onClick={handlePreviousPeriod}>
              <TrendingDown className="h-4 w-4 rotate-90" />
            </Button>
            <span className="text-sm font-medium min-w-[200px] text-center">
              {getPeriodLabel()}
            </span>
            <Button variant="ghost" size="icon" onClick={handleNextPeriod} disabled={periodEnd >= endOfMonth(new Date())}>
              <TrendingUp className="h-4 w-4 rotate-90" />
            </Button>
          </div>
          <Button variant="outline" onClick={handleExportFinancialReport}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Current Period Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Period Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">${currentPeriodData.totalIncome.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {getPeriodLabel()}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Period Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${currentPeriodData.totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {getPeriodLabel()}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Period Net</CardTitle>
            <DollarSign className={`h-4 w-4 ${currentPeriodData.netIncome >= 0 ? 'text-success' : 'text-destructive'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${currentPeriodData.netIncome >= 0 ? 'text-success' : 'text-destructive'}`}>
              ${currentPeriodData.netIncome.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentPeriodData.netIncome >= 0 ? 'Profit' : 'Loss'}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Profit Margin</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${currentPeriodData.netIncome >= 0 ? 'text-success' : 'text-destructive'}`}>
              {currentPeriodData.totalIncome > 0 ? (currentPeriodData.netIncome / currentPeriodData.totalIncome * 100).toFixed(1) : '0.0'}%
            </div>
            <p className="text-xs text-muted-foreground">Current period</p>
          </CardContent>
        </Card>
      </div>

      {/* Period Financial Performance Tracker */}
      <Card className="dashboard-card border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Period Financial Performance Tracker
              </CardTitle>
              <CardDescription>
                Compare period-over-period financial performance
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Current Period Income */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Current Period Revenue</div>
              <div className="text-3xl font-bold text-success">
                ${currentPeriodData.totalIncome.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                {getPeriodLabel()}
              </div>
            </div>

            {/* Current Period Expenses */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Current Period Expenses</div>
              <div className="text-2xl font-semibold text-destructive">
                ${currentPeriodData.totalExpenses.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                Working + Fixed Capital
              </div>
            </div>

            {/* Current Period Net */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Current Period Net</div>
              <div className={`text-2xl font-semibold ${currentPeriodData.netIncome >= 0 ? 'text-success' : 'text-destructive'}`}>
                ${currentPeriodData.netIncome.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                {currentPeriodData.netIncome >= 0 ? 'Profit' : 'Loss'}
              </div>
            </div>

            {/* Previous Period Net */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Previous Period Net</div>
              <div className={`text-2xl font-semibold text-muted-foreground`}>
                ${previousPeriodData.netIncome.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(previousPeriodStart, 'MMM yy')} - {format(previousPeriodEnd, 'MMM yy')}
              </div>
            </div>

            {/* Period-over-Period Change */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Period-over-Period</div>
              <div className={`flex items-center gap-2 ${netChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                {netChange >= 0 ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownRight className="h-6 w-6" />}
                <span className="text-2xl font-bold">
                  {Math.abs(netPercentage).toFixed(1)}%
                </span>
              </div>
              <div className={`text-sm ${netChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                {netChange >= 0 ? '+' : '-'}${Math.abs(netChange).toFixed(2)} from previous
              </div>
            </div>
          </div>

          {/* Detailed breakdown row */}
          <div className="mt-6 pt-6 border-t">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Income Change */}
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Income Change</div>
                <div className={`flex items-center gap-2 ${incomeChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {incomeChange >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  <span className="text-lg font-bold">
                    {incomeChange >= 0 ? '+' : '-'}${Math.abs(incomeChange).toFixed(2)}
                  </span>
                  <span className="text-sm">
                    ({Math.abs(incomePercentage).toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* Expense Change */}
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Expense Change</div>
                <div className={`flex items-center gap-2 ${expenseChange <= 0 ? 'text-success' : 'text-destructive'}`}>
                  {expenseChange >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  <span className="text-lg font-bold">
                    {expenseChange >= 0 ? '+' : '-'}${Math.abs(expenseChange).toFixed(2)}
                  </span>
                  <span className="text-sm">
                    ({Math.abs(expensePercentage).toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* Profit Margin Change */}
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Profit Margin</div>
                <div className="text-lg font-bold text-foreground">
                  {currentPeriodData.totalIncome > 0 ? (currentPeriodData.netIncome / currentPeriodData.totalIncome * 100).toFixed(1) : '0.0'}%
                </div>
                <div className="text-xs text-muted-foreground">
                  Previous: {previousPeriodData.totalIncome > 0 ? (previousPeriodData.netIncome / previousPeriodData.totalIncome * 100).toFixed(1) : '0.0'}%
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Trend Chart */}
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Financial Performance Trend</CardTitle>
              <CardDescription>
                Monthly breakdown of income, expenses, and net profit
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                  <Bar dataKey="income" fill="#10b981" name="Income" />
                  <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                  <Bar dataKey="net" fill="#3b82f6" name="Net Profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Color Legend */}
            <div className="flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{
                backgroundColor: '#10b981'
              }}></div>
                <span className="text-sm font-medium">Income</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{
                backgroundColor: '#ef4444'
              }}></div>
                <span className="text-sm font-medium">Expenses</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{
                backgroundColor: '#3b82f6'
              }}></div>
                <span className="text-sm font-medium">Net Profit</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Income and Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Current Period Income Breakdown</CardTitle>
            <CardDescription>Distribution of income sources</CardDescription>
          </CardHeader>
          <CardContent>
            {incomeBreakdown.length > 0 ? <div className="space-y-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie data={incomeBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {incomeBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                {/* Color Legend */}
                <div className="flex justify-center gap-6">
                  {incomeBreakdown.map((entry, index) => <div key={entry.name} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{
                  backgroundColor: entry.color
                }}></div>
                      <span className="text-sm font-medium">{entry.name}</span>
                      <span className="text-sm text-muted-foreground">${entry.value.toFixed(2)}</span>
                    </div>)}
                </div>
              </div> : <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No income data for current period</p>
                </div>
              </div>}
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Current Month Expense Breakdown</CardTitle>
            <CardDescription>Distribution of expense categories</CardDescription>
          </CardHeader>
          <CardContent>
            {expenseBreakdown.length > 0 ? <div className="space-y-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {expenseBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                {/* Color Legend */}
                <div className="flex justify-center gap-6">
                  {expenseBreakdown.map((entry, index) => <div key={entry.name} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{
                  backgroundColor: entry.color
                }}></div>
                      <span className="text-sm font-medium">{entry.name}</span>
                      <span className="text-sm text-muted-foreground">${entry.value.toFixed(2)}</span>
                    </div>)}
                </div>
              </div> : <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No expense data for current month</p>
                </div>
              </div>}
          </CardContent>
        </Card>
      </div>

      {/* Period Summary */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Period Summary</CardTitle>
          <CardDescription>
            Financial totals for {getPeriodLabel()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-600">${periodTotals.income.toFixed(2)}</div>
              <div className="text-sm text-green-700 dark:text-green-300">Total Income</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-2xl font-bold text-red-600">${periodTotals.expenses.toFixed(2)}</div>
              <div className="text-sm text-red-700 dark:text-red-300">Total Expenses</div>
            </div>
            <div className={`text-center p-4 rounded-lg ${periodTotals.net >= 0 ? 'bg-blue-50 dark:bg-blue-950' : 'bg-gray-50 dark:bg-gray-950'}`}>
              <div className={`text-2xl font-bold ${periodTotals.net >= 0 ? 'text-blue-600' : 'text-gray-600'}`}>
                ${periodTotals.net.toFixed(2)}
              </div>
              <div className={`text-sm ${periodTotals.net >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                Net {periodTotals.net >= 0 ? 'Profit' : 'Loss'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>;
}