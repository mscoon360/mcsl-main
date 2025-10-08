import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, Calendar, DollarSign, User, Package, Filter, TrendingUp, FileText, Download, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isWithinInterval, parseISO, differenceInMonths } from "date-fns";
import * as XLSX from 'xlsx';
import { useSales } from "@/hooks/useSales";
import { usePaymentSchedules } from "@/hooks/usePaymentSchedules";
import { supabase } from "@/integrations/supabase/client";
export default function Income() {
  const {
    toast
  } = useToast();
  const {
    user,
    isAdmin
  } = useAuth();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [viewType, setViewType] = useState<'summary' | 'detailed' | 'breakdown'>('summary');
  const [incomeSource, setIncomeSource] = useState<'all' | 'sales' | 'collections'>('all');
  const [hasFinanceAccess, setHasFinanceAccess] = useState(false);
  const {
    sales: supabaseSales
  } = useSales();
  const {
    paymentSchedules: supabasePaymentSchedules
  } = usePaymentSchedules();

  // Check access permissions - only admins and Finance department users can see all data
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        navigate('/auth');
        return;
      }

      if (isAdmin) {
        setHasFinanceAccess(true);
        return;
      }

      const {
        data
      } = await supabase.from('department_visibility').select('department').eq('user_id', user.id);
      const allowedSections = data?.map(d => d.department) || [];
      const hasAccess = allowedSections.includes('Finance-Income') || allowedSections.includes('Finance');
      
      if (!hasAccess) {
        // Redirect sales reps and other users away from Income page
        navigate('/');
      } else {
        setHasFinanceAccess(true);
      }
    };
    checkAccess();
  }, [user, isAdmin, navigate]);

  // Map Supabase sales to expected format
  // Admins and Finance users see all sales, regular users see only their own
  const sales = (isAdmin || hasFinanceAccess ? supabaseSales : supabaseSales.filter(s => s.user_id === user?.id)).map(sale => ({
    id: sale.id,
    customer: sale.customer_name,
    total: sale.total,
    items: sale.items.map(item => ({
      product: item.product_name,
      quantity: item.quantity,
      price: item.price,
      isRental: item.is_rental,
      contractLength: item.contract_length,
      paymentPeriod: item.payment_period,
      startDate: item.start_date ? new Date(item.start_date) : undefined,
      endDate: item.end_date ? new Date(item.end_date) : undefined
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

  // Calculate monthly revenue based on contract amounts + spot purchases
  const calculateMonthlyRevenue = (month: string) => {
    const monthStart = startOfMonth(parseISO(`${month}-01`));
    const monthEnd = endOfMonth(parseISO(`${month}-01`));

    // Spot purchases (non-rental sales made this month)
    const spotPurchases = sales.filter(sale => {
      const saleDate = parseISO(sale.date);
      const hasNoRentalItems = !sale.items.some(item => item.isRental);
      return isWithinInterval(saleDate, {
        start: monthStart,
        end: monthEnd
      }) && hasNoRentalItems;
    }).reduce((sum, sale) => sum + sale.total, 0);

    // Total monthly amount from ALL active rental contracts
    const monthlyContractAmount = sales.flatMap(sale => sale.items.filter(item => {
      if (!item.isRental || !item.startDate || !item.endDate) return false;
      // startDate/endDate are Date objects already; compare directly
      const startDate = item.startDate as Date;
      const endDate = item.endDate as Date;
      // Include contract if it's active during the selected month
      return startDate <= monthEnd && endDate >= monthStart;
    }).map(item => {
      // Monthly rental price × quantity (payment period not considered)
      return item.price * item.quantity;
    })).reduce((sum, amount) => sum + amount, 0);

    // Current month revenue = Sales (non-rental items sold this month) + Monthly contract amounts
    return {
      total: spotPurchases + monthlyContractAmount,
      rentalRevenue: monthlyContractAmount,
      purchaseRevenue: spotPurchases
    };
  };

  // Calculate income data for selected month (for detailed views)
  const calculateIncomeData = (month: string) => {
    const monthStart = startOfMonth(parseISO(`${month}-01`));
    const monthEnd = endOfMonth(parseISO(`${month}-01`));

    // Sales income (non-rental sales only)
    const salesData = sales.filter(sale => {
      const saleDate = parseISO(sale.date);
      return isWithinInterval(saleDate, {
        start: monthStart,
        end: monthEnd
      }) && !sale.items.some(item => item.isRental);
    });
    const salesIncome = salesData.reduce((sum, sale) => sum + sale.total, 0);

    // Collection income (rental payments received)
    const collectionsData = paidPayments.filter(payment => {
      const paymentDate = parseISO(payment.paidDate);
      return isWithinInterval(paymentDate, {
        start: monthStart,
        end: monthEnd
      });
    });
    const collectionIncome = collectionsData.reduce((sum, payment) => sum + payment.amount, 0);
    return {
      salesData,
      collectionsData,
      salesIncome,
      collectionIncome,
      totalIncome: salesIncome + collectionIncome
    };
  };
  const incomeData = calculateIncomeData(selectedMonth);

  // Calculate monthly revenue for current and previous month
  const currentMonthData = calculateMonthlyRevenue(selectedMonth);
  const currentMonthRevenue = currentMonthData.total;
  const getPreviousMonth = (month: string) => {
    const currentDate = parseISO(`${month}-01`);
    const previousDate = subMonths(currentDate, 1);
    return format(previousDate, 'yyyy-MM');
  };
  const previousMonth = getPreviousMonth(selectedMonth);
  const previousMonthData = calculateMonthlyRevenue(previousMonth);
  const previousMonthRevenue = previousMonthData.total;

  // Calculate month-over-month change
  const calculateMonthlyChange = () => {
    if (previousMonthRevenue === 0) {
      return {
        percentage: 0,
        change: currentMonthRevenue,
        isIncrease: true
      };
    }
    const change = currentMonthRevenue - previousMonthRevenue;
    const percentage = change / previousMonthRevenue * 100;
    return {
      percentage: Math.abs(percentage),
      change: Math.abs(change),
      isIncrease: change >= 0
    };
  };
  const monthlyChange = calculateMonthlyChange();

  // Calculate total contract value from all rental agreements
  const calculateTotalContractValue = () => {
    return sales.flatMap(sale => sale.items.filter(item => item.isRental && item.startDate && item.endDate).map(item => {
      const startDate = new Date(item.startDate!);
      const endDate = new Date(item.endDate!);
      const monthsInContract = differenceInMonths(endDate, startDate);
      return item.price * monthsInContract * item.quantity;
    })).reduce((sum, value) => sum + value, 0);
  };
  const totalContractValue = calculateTotalContractValue();

  // Filter data based on income source
  const getFilteredData = () => {
    switch (incomeSource) {
      case 'sales':
        return {
          items: incomeData.salesData.map(sale => ({
            id: sale.id,
            type: 'sale' as const,
            customer: sale.customer,
            description: `Sale of ${sale.items.length} items`,
            amount: sale.total,
            date: sale.date,
            items: sale.items
          })),
          total: incomeData.salesIncome
        };
      case 'collections':
        return {
          items: incomeData.collectionsData.map(payment => ({
            id: payment.id,
            type: 'collection' as const,
            customer: payment.customer,
            description: `Payment for ${payment.product}`,
            amount: payment.amount,
            date: payment.paidDate,
            paymentMethod: payment.paymentMethod
          })),
          total: incomeData.collectionIncome
        };
      default:
        return {
          items: [...incomeData.salesData.map(sale => ({
            id: sale.id,
            type: 'sale' as const,
            customer: sale.customer,
            description: `Sale of ${sale.items.length} items`,
            amount: sale.total,
            date: sale.date,
            items: sale.items
          })), ...incomeData.collectionsData.map(payment => ({
            id: payment.id,
            type: 'collection' as const,
            customer: payment.customer,
            description: `Payment for ${payment.product}`,
            amount: payment.amount,
            date: payment.paidDate,
            paymentMethod: payment.paymentMethod
          }))].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          total: incomeData.totalIncome
        };
    }
  };
  const filteredData = getFilteredData();
  const handleExportMonthlyRevenue = () => {
    // Generate last 6 months of data
    const currentDate = new Date();
    const months = eachMonthOfInterval({
      start: subMonths(currentDate, 5),
      end: currentDate
    });
    const monthlyData = months.map(date => {
      const monthStr = format(date, 'yyyy-MM');
      const revenueData = calculateMonthlyRevenue(monthStr);
      return {
        Month: format(date, 'MMMM yyyy'),
        Revenue: revenueData.total,
        'Change from Previous': ''
      };
    });

    // Calculate month-over-month changes
    for (let i = 1; i < monthlyData.length; i++) {
      const current = monthlyData[i].Revenue;
      const previous = monthlyData[i - 1].Revenue;
      const change = current - previous;
      const percentage = previous !== 0 ? change / previous * 100 : 0;
      monthlyData[i]['Change from Previous'] = `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${percentage.toFixed(1)}%)`;
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(monthlyData);

    // Set column widths
    ws['!cols'] = [{
      width: 20
    },
    // Month
    {
      width: 15
    },
    // Revenue
    {
      width: 25
    } // Change from Previous
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Revenue');

    // Generate filename
    const filename = `Monthly_Revenue_${format(new Date(), 'yyyy_MM')}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
    toast({
      title: "Monthly Revenue Exported",
      description: `Monthly revenue report downloaded as ${filename}`
    });
  };
  const handleExportIncomeReport = () => {
    // Prepare income transactions for Excel
    const transactionExport = filteredData.items.map(item => ({
      Date: format(parseISO(item.date), 'MM/dd/yyyy'),
      Type: item.type === 'sale' ? 'Product Sale' : 'Rental Payment',
      Customer: item.customer,
      Description: item.description,
      Amount: item.amount,
      'Payment Method': item.type === 'collection' ? item.paymentMethod || 'N/A' : 'N/A'
    }));

    // Add summary data
    const summaryData = [{
      Date: '',
      Type: '',
      Customer: '',
      Description: '',
      Amount: '',
      'Payment Method': ''
    }, {
      Date: '',
      Type: 'SUMMARY',
      Customer: '',
      Description: '',
      Amount: '',
      'Payment Method': ''
    }, {
      Date: '',
      Type: 'Total Income',
      Customer: '',
      Description: '',
      Amount: incomeData.totalIncome,
      'Payment Method': ''
    }, {
      Date: '',
      Type: 'Sales Income',
      Customer: '',
      Description: '',
      Amount: incomeData.salesIncome,
      'Payment Method': ''
    }, {
      Date: '',
      Type: 'Collection Income',
      Customer: '',
      Description: '',
      Amount: incomeData.collectionIncome,
      'Payment Method': ''
    }, {
      Date: '',
      Type: 'Total Contract Value',
      Customer: '',
      Description: '',
      Amount: totalContractValue,
      'Payment Method': ''
    }];
    const finalData = [...transactionExport, ...summaryData];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(finalData);

    // Set column widths
    ws['!cols'] = [{
      width: 12
    },
    // Date
    {
      width: 18
    },
    // Type
    {
      width: 20
    },
    // Customer
    {
      width: 40
    },
    // Description
    {
      width: 12
    },
    // Amount
    {
      width: 15
    } // Payment Method
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Income Report');

    // Generate filename
    const filename = `Income_Details_${format(parseISO(`${selectedMonth}-01`), 'yyyy_MM')}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
    toast({
      title: "Income Report Exported",
      description: `Income report downloaded as ${filename}`
    });
  };
  return <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Income Tracking</h1>
          <p className="text-muted-foreground">Detailed breakdown of all income sources</p>
        </div>
          <div className="flex gap-2">
            <Select value={viewType} onValueChange={(value: 'summary' | 'detailed' | 'breakdown') => setViewType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Summary</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
                <SelectItem value="breakdown">Breakdown</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(option => <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExportIncomeReport}>
              <Download className="h-4 w-4 mr-2" />
              Export Income Details
            </Button>
          </div>
      </div>

      {/* Monthly Revenue Tracker */}
      <Card className="dashboard-card border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Revenue Tracker
              </CardTitle>
              <CardDescription>
                Compare monthly revenue performance
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportMonthlyRevenue}>
              <Download className="h-4 w-4 mr-2" />
              Export Revenue Tracker
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Current Month */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Total Current Month Revenue</div>
              <div className="text-3xl font-bold text-foreground">
                ${currentMonthRevenue.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
              </div>
            </div>

            {/* Monthly Rental Revenue */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Monthly Rental Revenue</div>
              <div className="text-2xl font-semibold text-green-600">
                ${currentMonthData.rentalRevenue.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                From rental contracts
              </div>
            </div>

            {/* Monthly Purchase Revenue */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Monthly Purchase Revenue</div>
              <div className="text-2xl font-semibold text-blue-600">
                ${currentMonthData.purchaseRevenue.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                From spot purchases
              </div>
            </div>

            {/* Previous Month */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Previous Month Revenue</div>
              <div className="text-2xl font-semibold text-muted-foreground">
                ${previousMonthRevenue.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(parseISO(`${previousMonth}-01`), 'MMMM yyyy')}
              </div>
            </div>

            {/* Change Indicator */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Month-over-Month</div>
              <div className={`flex items-center gap-2 ${monthlyChange.isIncrease ? 'text-success' : 'text-destructive'}`}>
                {monthlyChange.isIncrease ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownRight className="h-6 w-6" />}
                <span className="text-2xl font-bold">
                  {monthlyChange.percentage.toFixed(1)}%
                </span>
              </div>
              <div className={`text-sm ${monthlyChange.isIncrease ? 'text-success' : 'text-destructive'}`}>
                {monthlyChange.isIncrease ? '+' : '-'}${monthlyChange.change.toFixed(2)} from last month
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="dashboard-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filter by source:</span>
            </div>
            <Select value={incomeSource} onValueChange={(value: 'all' | 'sales' | 'collections') => setIncomeSource(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="sales">Sales Only</SelectItem>
                <SelectItem value="collections">Collections Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Income Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">${incomeData.totalIncome.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Sales Income</CardTitle>
            <Receipt className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">${incomeData.salesIncome.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {incomeData.salesData.length} transaction{incomeData.salesData.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Contract Collection Income</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${incomeData.collectionIncome.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {incomeData.collectionsData.length} payment{incomeData.collectionsData.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Total Contract Value</CardTitle>
            <FileText className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">${totalContractValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              All rental agreements
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Avg. Transaction</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${filteredData.items.length > 0 ? (filteredData.total / filteredData.items.length).toFixed(2) : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Income Details */}
      {viewType === 'summary' && <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Income Summary</CardTitle>
            <CardDescription>
              Overview of income sources for {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-800 dark:text-blue-200">Product Sales</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">${incomeData.salesIncome.toFixed(2)}</div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    {incomeData.salesData.length} sales transactions
                  </div>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800 dark:text-green-200">Rental Collections</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">${incomeData.collectionIncome.toFixed(2)}</div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    {incomeData.collectionsData.length} payments received
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>}

      {viewType === 'detailed' && <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Detailed Income Records</CardTitle>
            <CardDescription>
              All income transactions for {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
              {incomeSource !== 'all' && ` - ${incomeSource === 'sales' ? 'Sales' : 'Collections'} only`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredData.items.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No income records found for this period</p>
              </div> : <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.items.map(item => <TableRow key={item.id}>
                      <TableCell>{format(parseISO(item.date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant={item.type === 'sale' ? 'default' : 'secondary'}>
                          {item.type === 'sale' ? 'Sale' : 'Collection'}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {item.customer}
                      </TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right font-bold text-success">
                        ${item.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>}
          </CardContent>
        </Card>}

      {viewType === 'breakdown' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Sales Breakdown</CardTitle>
              <CardDescription>Product sales for {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}</CardDescription>
            </CardHeader>
            <CardContent>
              {incomeData.salesData.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No sales recorded</p>
                </div> : <div className="space-y-3">
                  {incomeData.salesData.map(sale => <div key={sale.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{sale.customer}</div>
                        <div className="text-sm text-muted-foreground">
                          {sale.items.map(item => item.product).join(', ')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(parseISO(sale.date), 'MMM dd, yyyy')}
                        </div>
                      </div>
                      <div className="font-bold text-blue-600">
                        ${sale.total.toFixed(2)}
                      </div>
                    </div>)}
                </div>}
            </CardContent>
          </Card>

          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Collections Breakdown</CardTitle>
              <CardDescription>Rental payments received in {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}</CardDescription>
            </CardHeader>
            <CardContent>
              {incomeData.collectionsData.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No collections recorded</p>
                </div> : <div className="space-y-3">
                  {incomeData.collectionsData.map(payment => <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{payment.customer}</div>
                        <div className="text-sm text-muted-foreground">{payment.product}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Paid {format(parseISO(payment.paidDate), 'MMM dd, yyyy')}</span>
                          <span>•</span>
                          <Badge variant="outline" className="text-xs">{payment.paymentMethod}</Badge>
                        </div>
                      </div>
                      <div className="font-bold text-green-600">
                        ${payment.amount.toFixed(2)}
                      </div>
                    </div>)}
                </div>}
            </CardContent>
          </Card>
        </div>}

      {/* All Sales Log */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Complete Sales Log
          </CardTitle>
          <CardDescription>
            All sales transactions across all periods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Sales Rep</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supabaseSales.length === 0 ? <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No sales found
                    </TableCell>
                  </TableRow> : supabaseSales.map(sale => <TableRow key={sale.id}>
                      <TableCell className="text-muted-foreground">
                        {format(parseISO(sale.date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">{sale.customer_name}</TableCell>
                      <TableCell className="text-muted-foreground">{sale.rep_name}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {sale.items.map((item, idx) => <div key={idx} className="text-sm">
                              {item.product_name} x{item.quantity}
                              {item.is_rental && <Badge variant="outline" className="ml-2 text-xs">Rental</Badge>}
                            </div>)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sale.status === 'completed' ? 'default' : 'secondary'}>
                          {sale.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        ${sale.total.toFixed(2)}
                      </TableCell>
                    </TableRow>)}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>;
}