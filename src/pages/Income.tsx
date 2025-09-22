import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, Calendar, DollarSign, User, Package, Filter, TrendingUp } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isWithinInterval, parseISO } from "date-fns";

export default function Income() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [viewType, setViewType] = useState<'summary' | 'detailed' | 'breakdown'>('summary');
  const [incomeSource, setIncomeSource] = useState<'all' | 'sales' | 'collections'>('all');

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
    }>;
    date: string;
    status: string;
  }>>('dashboard-sales', []);

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

  // Calculate income data for selected month
  const calculateIncomeData = (month: string) => {
    const monthStart = startOfMonth(parseISO(`${month}-01`));
    const monthEnd = endOfMonth(parseISO(`${month}-01`));

    // Sales income (non-rental sales only)
    const salesData = sales
      .filter(sale => {
        const saleDate = parseISO(sale.date);
        return isWithinInterval(saleDate, { start: monthStart, end: monthEnd }) &&
               !sale.items.some(item => item.isRental);
      });

    const salesIncome = salesData.reduce((sum, sale) => sum + sale.total, 0);

    // Collection income (rental payments received)
    const collectionsData = paidPayments
      .filter(payment => {
        const paymentDate = parseISO(payment.paidDate);
        return isWithinInterval(paymentDate, { start: monthStart, end: monthEnd });
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
          items: [
            ...incomeData.salesData.map(sale => ({
              id: sale.id,
              type: 'sale' as const,
              customer: sale.customer,
              description: `Sale of ${sale.items.length} items`,
              amount: sale.total,
              date: sale.date,
              items: sale.items
            })),
            ...incomeData.collectionsData.map(payment => ({
              id: payment.id,
              type: 'collection' as const,
              customer: payment.customer,
              description: `Payment for ${payment.product}`,
              amount: payment.amount,
              date: payment.paidDate,
              paymentMethod: payment.paymentMethod
            }))
          ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          total: incomeData.totalIncome
        };
    }
  };

  const filteredData = getFilteredData();

  return (
    <div className="space-y-6">
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
              {monthOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <CardTitle className="text-sm font-medium text-card-foreground">Collection Income</CardTitle>
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
            <CardTitle className="text-sm font-medium text-card-foreground">Avg. Transaction</CardTitle>
            <Calendar className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              ${filteredData.items.length > 0 ? (filteredData.total / filteredData.items.length).toFixed(2) : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Income Details */}
      {viewType === 'summary' && (
        <Card className="dashboard-card">
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
        </Card>
      )}

      {viewType === 'detailed' && (
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">Detailed Income Records</CardTitle>
            <CardDescription>
              All income transactions for {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}
              {incomeSource !== 'all' && ` - ${incomeSource === 'sales' ? 'Sales' : 'Collections'} only`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredData.items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No income records found for this period</p>
              </div>
            ) : (
              <Table>
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
                  {filteredData.items.map((item) => (
                    <TableRow key={item.id}>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {viewType === 'breakdown' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Sales Breakdown</CardTitle>
              <CardDescription>Product sales for {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}</CardDescription>
            </CardHeader>
            <CardContent>
              {incomeData.salesData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No sales recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incomeData.salesData.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 border rounded-lg">
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="dashboard-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Collections Breakdown</CardTitle>
              <CardDescription>Rental payments received in {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}</CardDescription>
            </CardHeader>
            <CardContent>
              {incomeData.collectionsData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No collections recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incomeData.collectionsData.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}