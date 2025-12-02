import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  CalendarIcon, 
  FileText, 
  Download, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  CreditCard,
  Wallet,
  PieChart
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSales } from '@/hooks/useSales';
import { useExpenditures } from '@/hooks/useExpenditures';
import { useAccountsPayable } from '@/hooks/useAccountsPayable';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

type DateRange = {
  from: Date;
  to: Date;
};

export default function FinanceReports() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [reportPeriod, setReportPeriod] = useState('this-month');
  
  const { sales } = useSales();
  const { expenditures } = useExpenditures();
  const { bills } = useAccountsPayable();
  const [arInvoices, setArInvoices] = useState<any[]>([]);

  // Fetch invoices directly from invoices table (same as AccountsReceivable page)
  useEffect(() => {
    const fetchInvoices = async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('due_date', { ascending: true });
      if (!error && data) {
        setArInvoices(data);
      }
    };
    fetchInvoices();
  }, []);

  // Handle preset period changes
  const handlePeriodChange = (period: string) => {
    setReportPeriod(period);
    const now = new Date();
    
    switch (period) {
      case 'this-month':
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
        break;
      case 'this-quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
        setDateRange({ from: quarterStart, to: quarterEnd });
        break;
      case 'this-year':
        setDateRange({ from: startOfYear(now), to: endOfYear(now) });
        break;
    }
  };

  // Filter data by date range
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate >= dateRange.from && saleDate <= dateRange.to;
    });
  }, [sales, dateRange]);

  const filteredExpenditures = useMemo(() => {
    return expenditures.filter(exp => {
      const expDate = new Date(exp.date);
      return expDate >= dateRange.from && expDate <= dateRange.to;
    });
  }, [expenditures, dateRange]);

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const billDate = new Date(bill.bill_date);
      return billDate >= dateRange.from && billDate <= dateRange.to;
    });
  }, [bills, dateRange]);

  const filteredInvoices = useMemo(() => {
    return arInvoices.filter(inv => {
      const invDate = new Date(inv.issue_date);
      return invDate >= dateRange.from && invDate <= dateRange.to;
    });
  }, [arInvoices, dateRange]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const outputVAT = filteredSales.reduce((sum, s) => sum + (s.vat_amount || 0), 0);
    
    const totalExpenses = filteredExpenditures.reduce((sum, e) => sum + e.amount, 0);
    const inputVAT = filteredExpenditures.reduce((sum, e) => sum + (e.vat_amount || 0), 0);
    
    const totalPayables = filteredBills.reduce((sum, b) => sum + b.amount, 0);
    const payablesPaid = filteredBills.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.amount, 0);
    const payablesOutstanding = filteredBills.filter(b => b.status !== 'paid').reduce((sum, b) => sum + (b.amount - b.amount_paid), 0);
    const inputVATFromBills = filteredBills.reduce((sum, b) => sum + (b.vat_amount || 0), 0);
    
    const totalReceivables = filteredInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const receivablesCollected = filteredInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0);
    const receivablesOutstanding = filteredInvoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.total || 0), 0);
    const outputVATFromReceivables = filteredInvoices.reduce((sum, i) => sum + (i.tax_amount || 0), 0);
    
    const netVAT = outputVAT + outputVATFromReceivables - inputVAT - inputVATFromBills;
    const grossProfit = totalRevenue - totalExpenses;
    
    return {
      totalRevenue,
      outputVAT,
      totalExpenses,
      inputVAT,
      totalPayables,
      payablesPaid,
      payablesOutstanding,
      inputVATFromBills,
      totalReceivables,
      receivablesCollected,
      receivablesOutstanding,
      outputVATFromReceivables,
      netVAT,
      grossProfit
    };
  }, [filteredSales, filteredExpenditures, filteredBills, filteredInvoices]);

  // Chart data
  const revenueVsExpenseData = [
    { name: 'Revenue', value: metrics.totalRevenue },
    { name: 'Expenses', value: metrics.totalExpenses }
  ];

  const vatSummaryData = [
    { name: 'Output VAT (Sales)', value: metrics.outputVAT },
    { name: 'Output VAT (Receivables)', value: metrics.outputVATFromReceivables },
    { name: 'Input VAT (Expenses)', value: metrics.inputVAT },
    { name: 'Input VAT (Payables)', value: metrics.inputVATFromBills }
  ];

  const cashFlowData = [
    { category: 'Sales Revenue', amount: metrics.totalRevenue, type: 'income' },
    { category: 'AR Collected', amount: metrics.receivablesCollected, type: 'income' },
    { category: 'Expenses', amount: -metrics.totalExpenses, type: 'expense' },
    { category: 'AP Paid', amount: -metrics.payablesPaid, type: 'expense' }
  ];

  const generateExecutiveReport = () => {
    const report = `
EXECUTIVE FINANCIAL REPORT
Period: ${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}
Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}

═══════════════════════════════════════════════════════════

REVENUE & PROFITABILITY
─────────────────────────────────────────────────────────────
Total Revenue:              $${metrics.totalRevenue.toLocaleString()}
Total Expenses:             $${metrics.totalExpenses.toLocaleString()}
Gross Profit:               $${metrics.grossProfit.toLocaleString()}
Profit Margin:              ${metrics.totalRevenue > 0 ? ((metrics.grossProfit / metrics.totalRevenue) * 100).toFixed(1) : 0}%

═══════════════════════════════════════════════════════════

ACCOUNTS RECEIVABLE
─────────────────────────────────────────────────────────────
Total Invoiced:             $${metrics.totalReceivables.toLocaleString()}
Collected:                  $${metrics.receivablesCollected.toLocaleString()}
Outstanding:                $${metrics.receivablesOutstanding.toLocaleString()}
Collection Rate:            ${metrics.totalReceivables > 0 ? ((metrics.receivablesCollected / metrics.totalReceivables) * 100).toFixed(1) : 0}%

═══════════════════════════════════════════════════════════

ACCOUNTS PAYABLE
─────────────────────────────────────────────────────────────
Total Bills:                $${metrics.totalPayables.toLocaleString()}
Paid:                       $${metrics.payablesPaid.toLocaleString()}
Outstanding:                $${metrics.payablesOutstanding.toLocaleString()}

═══════════════════════════════════════════════════════════

VAT SUMMARY
─────────────────────────────────────────────────────────────
Output VAT (Collected):     $${(metrics.outputVAT + metrics.outputVATFromReceivables).toLocaleString()}
Input VAT (Paid):           $${(metrics.inputVAT + metrics.inputVATFromBills).toLocaleString()}
Net VAT Liability:          $${metrics.netVAT.toLocaleString()}

═══════════════════════════════════════════════════════════
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `executive-report-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Finance Reports</h1>
          <p className="text-muted-foreground">Comprehensive financial overview and executive reporting</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={reportPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="this-quarter">This Quarter</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                    setReportPeriod('custom');
                  }
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          
          <Button onClick={generateExecutiveReport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {filteredSales.length} sales transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {filteredExpenditures.length} expense entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
            {metrics.grossProfit >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              metrics.grossProfit >= 0 ? "text-green-600" : "text-destructive"
            )}>
              ${metrics.grossProfit.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalRevenue > 0 ? ((metrics.grossProfit / metrics.totalRevenue) * 100).toFixed(1) : 0}% margin
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net VAT</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              metrics.netVAT >= 0 ? "text-destructive" : "text-green-600"
            )}>
              ${Math.abs(metrics.netVAT).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.netVAT >= 0 ? 'Payable to tax authority' : 'Refund due'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownRight className="h-5 w-5 text-green-500" />
              Accounts Receivable
            </CardTitle>
            <CardDescription>Money owed to the business</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Invoiced</p>
                <p className="text-xl font-semibold">${metrics.totalReceivables.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className="text-xl font-semibold text-green-600">${metrics.receivablesCollected.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-xl font-semibold text-amber-600">${metrics.receivablesOutstanding.toLocaleString()}</p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Output VAT</span>
                <Badge variant="secondary">${metrics.outputVATFromReceivables.toLocaleString()}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-destructive" />
              Accounts Payable
            </CardTitle>
            <CardDescription>Money owed by the business</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Bills</p>
                <p className="text-xl font-semibold">${metrics.totalPayables.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-xl font-semibold text-green-600">${metrics.payablesPaid.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-xl font-semibold text-destructive">${metrics.payablesOutstanding.toLocaleString()}</p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Input VAT</span>
                <Badge variant="secondary">${metrics.inputVATFromBills.toLocaleString()}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* VAT Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            VAT Summary
          </CardTitle>
          <CardDescription>Value Added Tax breakdown for the period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={vatSummaryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `$${value.toLocaleString()}`}
                  >
                    {vatSummaryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Output VAT (Sales)</TableCell>
                  <TableCell className="text-right font-mono">${metrics.outputVAT.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Output VAT (Receivables)</TableCell>
                  <TableCell className="text-right font-mono">${metrics.outputVATFromReceivables.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Input VAT (Expenses)</TableCell>
                  <TableCell className="text-right font-mono">${metrics.inputVAT.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Input VAT (Payables)</TableCell>
                  <TableCell className="text-right font-mono">${metrics.inputVATFromBills.toLocaleString()}</TableCell>
                </TableRow>
                <TableRow className="font-bold border-t-2">
                  <TableCell>Net VAT {metrics.netVAT >= 0 ? '(Payable)' : '(Refund)'}</TableCell>
                  <TableCell className={cn(
                    "text-right font-mono",
                    metrics.netVAT >= 0 ? "text-destructive" : "text-green-600"
                  )}>
                    ${Math.abs(metrics.netVAT).toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow Overview</CardTitle>
          <CardDescription>Income vs expenses for the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `$${Math.abs(value).toLocaleString()}`} />
                <YAxis type="category" dataKey="category" width={120} />
                <Tooltip 
                  formatter={(value: number) => [`$${Math.abs(value).toLocaleString()}`, value >= 0 ? 'Income' : 'Expense']}
                />
                <Bar 
                  dataKey="amount" 
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
