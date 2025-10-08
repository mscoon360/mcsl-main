import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, Receipt, Calendar, BarChart3, PieChart, Download } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths, isWithinInterval, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, LineChart, Line, Pie } from "recharts";
import * as XLSX from 'xlsx';
import { useSales } from "@/hooks/useSales";
import { usePaymentSchedules } from "@/hooks/usePaymentSchedules";
import { supabase } from "@/integrations/supabase/client";

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
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState('12-months');
  const { sales: supabaseSales } = useSales();
  const { paymentSchedules: supabasePaymentSchedules } = usePaymentSchedules();

  // Check access permissions
  useEffect(() => {
    const checkAccess = async () => {
      if (!user || isAdmin) return;
      
      const { data } = await supabase
        .from('department_visibility')
        .select('department')
        .eq('user_id', user.id);
      
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
  const paidPayments = supabasePaymentSchedules
    .filter(p => p.status === 'paid' && p.paid_date)
    .map(p => ({
      id: p.id,
      customer: p.customer,
      product: p.product,
      amount: p.amount,
      dueDate: p.due_date,
      paidDate: p.paid_date!,
      paymentMethod: p.payment_method || 'cash',
      status: 'paid' as const
    }));

  const [expenditures] = useLocalStorage<Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    category: 'working-capital' | 'fixed-capital';
    type: string;
  }>>('finance-expenditures', []);

  const calculateMonthlyFinancials = (month: string): MonthlyFinancials => {
    const monthStart = startOfMonth(parseISO(`${month}-01`));
    const monthEnd = endOfMonth(parseISO(`${month}-01`));

    const salesIncome = sales
      .filter(sale => {
        const saleDate = parseISO(sale.date);
        return isWithinInterval(saleDate, { start: monthStart, end: monthEnd }) &&
               !sale.items.some(item => item.isRental);
      })
      .reduce((sum, sale) => sum + sale.total, 0);

    const collectionIncome = paidPayments
      .filter(payment => {
        const paymentDate = parseISO(payment.paidDate);
        return isWithinInterval(paymentDate, { start: monthStart, end: monthEnd });
      })
      .reduce((sum, payment) => sum + payment.amount, 0);

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

    return {
      month,
      salesIncome,
      collectionIncome,
      totalIncome,
      workingCapitalExpenses,
      fixedCapitalExpenses,
      totalExpenses,
      netIncome: totalIncome - totalExpenses
    };
  };

  // Generate data for charts based on selected period
  const getPerformanceData = () => {
    const currentDate = new Date();
    let months: Date[] = [];

    switch (selectedPeriod) {
      case '6-months':
        months = eachMonthOfInterval({
          start: subMonths(currentDate, 5),
          end: currentDate
        });
        break;
      case '12-months':
        months = eachMonthOfInterval({
          start: subMonths(currentDate, 11),
          end: currentDate
        });
        break;
      case '24-months':
        months = eachMonthOfInterval({
          start: subMonths(currentDate, 23),
          end: currentDate
        });
        break;
      default:
        months = eachMonthOfInterval({
          start: subMonths(currentDate, 11),
          end: currentDate
        });
    }

    return months.map(date => {
      const monthStr = format(date, 'yyyy-MM');
      const data = calculateMonthlyFinancials(monthStr);
      return {
        month: format(date, 'MMM yy'),
        income: data.totalIncome,
        expenses: data.totalExpenses,
        net: data.netIncome
      };
    });
  };

  const currentMonth = format(new Date(), 'yyyy-MM');
  const currentMonthData = calculateMonthlyFinancials(currentMonth);
  const performanceData = getPerformanceData();

  // Calculate totals for current period
  const periodTotals = performanceData.reduce((acc, month) => ({
    income: acc.income + month.income,
    expenses: acc.expenses + month.expenses,
    net: acc.net + month.net
  }), { income: 0, expenses: 0, net: 0 });

  // Pie chart data for income breakdown
  const incomeBreakdown = [
    { name: 'Sales', value: currentMonthData.salesIncome, color: '#3b82f6' },
    { name: 'Collections', value: currentMonthData.collectionIncome, color: '#10b981' }
  ].filter(item => item.value > 0);

  // Pie chart data for expense breakdown
  const expenseBreakdown = [
    { name: 'Working Capital', value: currentMonthData.workingCapitalExpenses, color: '#f59e0b' },
    { name: 'Fixed Capital', value: currentMonthData.fixedCapitalExpenses, color: '#ef4444' }
  ].filter(item => item.value > 0);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  const handleExportFinancialReport = () => {
    // Prepare performance data for Excel
    const performanceExport = performanceData.map(month => ({
      Month: month.month,
      Income: month.income,
      Expenses: month.expenses,
      'Net Profit': month.net
    }));

    // Prepare summary data
    const summaryData = [
      { Month: '', Income: '', Expenses: '', 'Net Profit': '' },
      { Month: 'SUMMARY', Income: '', Expenses: '', 'Net Profit': '' },
      { Month: 'Total Income', Income: periodTotals.income, Expenses: '', 'Net Profit': '' },
      { Month: 'Total Expenses', Income: '', Expenses: periodTotals.expenses, 'Net Profit': '' },
      { Month: 'Net Profit/Loss', Income: '', Expenses: '', 'Net Profit': periodTotals.net },
      { Month: '', Income: '', Expenses: '', 'Net Profit': '' },
      { Month: 'Current Month Breakdown', Income: '', Expenses: '', 'Net Profit': '' },
      { Month: 'Sales Income', Income: currentMonthData.salesIncome, Expenses: '', 'Net Profit': '' },
      { Month: 'Collection Income', Income: currentMonthData.collectionIncome, Expenses: '', 'Net Profit': '' },
      { Month: 'Working Capital Expenses', Income: '', Expenses: currentMonthData.workingCapitalExpenses, 'Net Profit': '' },
      { Month: 'Fixed Capital Expenses', Income: '', Expenses: currentMonthData.fixedCapitalExpenses, 'Net Profit': '' }
    ];

    const finalData = [...performanceExport, ...summaryData];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(finalData);

    // Set column widths
    ws['!cols'] = [
      { width: 15 }, // Month
      { width: 15 }, // Income
      { width: 15 }, // Expenses
      { width: 15 }  // Net Profit
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Financial Overview');

    // Generate filename
    const filename = `Financial_Overview_${selectedPeriod}_${format(new Date(), 'yyyy_MM_dd')}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);

    toast({
      title: "Financial Report Exported",
      description: `Complete financial overview downloaded as ${filename}`
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Finance Overview</h1>
          <p className="text-muted-foreground">Comprehensive financial analysis and insights</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6-months">Last 6 Months</SelectItem>
              <SelectItem value="12-months">Last 12 Months</SelectItem>
              <SelectItem value="24-months">Last 24 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportFinancialReport}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Current Month Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Current Month Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">${currentMonthData.totalIncome.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(), 'MMMM yyyy')}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Current Month Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${currentMonthData.totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(), 'MMMM yyyy')}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Current Month Net</CardTitle>
            <DollarSign className={`h-4 w-4 ${currentMonthData.netIncome >= 0 ? 'text-success' : 'text-destructive'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${currentMonthData.netIncome >= 0 ? 'text-success' : 'text-destructive'}`}>
              ${currentMonthData.netIncome.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentMonthData.netIncome >= 0 ? 'Profit' : 'Loss'}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Profit Margin</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${currentMonthData.netIncome >= 0 ? 'text-success' : 'text-destructive'}`}>
              {currentMonthData.totalIncome > 0 ? ((currentMonthData.netIncome / currentMonthData.totalIncome) * 100).toFixed(1) : '0.0'}%
            </div>
            <p className="text-xs text-muted-foreground">Current month</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trend Chart */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Financial Performance Trend</CardTitle>
          <CardDescription>
            Income, expenses, and net profit over the selected period
          </CardDescription>
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
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
                <span className="text-sm font-medium">Income</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                <span className="text-sm font-medium">Expenses</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
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
            <CardTitle className="text-card-foreground">Current Month Income Breakdown</CardTitle>
            <CardDescription>Distribution of income sources</CardDescription>
          </CardHeader>
          <CardContent>
            {incomeBreakdown.length > 0 ? (
              <div className="space-y-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={incomeBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {incomeBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                {/* Color Legend */}
                <div className="flex justify-center gap-6">
                  {incomeBreakdown.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded" 
                        style={{ backgroundColor: entry.color }}
                      ></div>
                      <span className="text-sm font-medium">{entry.name}</span>
                      <span className="text-sm text-muted-foreground">${entry.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No income data for current month</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Current Month Expense Breakdown</CardTitle>
            <CardDescription>Distribution of expense categories</CardDescription>
          </CardHeader>
          <CardContent>
            {expenseBreakdown.length > 0 ? (
              <div className="space-y-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={expenseBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {expenseBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                {/* Color Legend */}
                <div className="flex justify-center gap-6">
                  {expenseBreakdown.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded" 
                        style={{ backgroundColor: entry.color }}
                      ></div>
                      <span className="text-sm font-medium">{entry.name}</span>
                      <span className="text-sm text-muted-foreground">${entry.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No expense data for current month</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Period Summary */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Period Summary</CardTitle>
          <CardDescription>
            Financial totals for the selected {selectedPeriod.replace('-', ' ')} period
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
    </div>
  );
}