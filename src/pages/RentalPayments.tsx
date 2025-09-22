import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, CreditCard, Calendar, DollarSign, User, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useToast } from "@/hooks/use-toast";
import { format, addMonths, addDays, differenceInDays, parseISO, startOfMonth, endOfMonth, isSameMonth } from "date-fns";

interface PaymentSchedule {
  id: string;
  agreementId: string;
  customer: string;
  product: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'due' | 'overdue';
  paidDate?: string;
  paymentMethod?: string;
  notes?: string;
}

export default function RentalPayments() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<'date' | 'month' | 'year'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Get sales data to extract rental agreements
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

  // Payment schedules storage
  const [paymentSchedules, setPaymentSchedules] = useLocalStorage<PaymentSchedule[]>('dashboard-payment-schedules', []);


  // Generate payment schedules from rental agreements
  useEffect(() => {
    const existingScheduleAgreements = new Set(paymentSchedules.map(p => p.agreementId));
    const newSchedules: PaymentSchedule[] = [];

    sales.forEach(sale => {
      sale.items
        .filter(item => item.isRental && item.startDate && item.endDate && item.paymentPeriod)
        .forEach((item, index) => {
          const agreementId = `${sale.id}-${index}`;
          
          if (!existingScheduleAgreements.has(agreementId)) {
            const startDate = new Date(item.startDate!);
            const endDate = new Date(item.endDate!);
            const monthlyAmount = item.price;
            
            // Generate payment schedule based on payment period
            let currentDate = new Date(startDate);
            let paymentIndex = 0;
            
            while (currentDate < endDate) { // Changed from <= to < to exclude end date
              let nextPaymentDate: Date;
              let periodMultiplier: number;
              
              switch (item.paymentPeriod) {
                case 'monthly':
                  nextPaymentDate = addMonths(currentDate, 1);
                  periodMultiplier = 1;
                  break;
                case 'quarterly':
                  nextPaymentDate = addMonths(currentDate, 3);
                  periodMultiplier = 3;
                  break;
                case 'biannually':
                  nextPaymentDate = addMonths(currentDate, 6);
                  periodMultiplier = 6;
                  break;
                case 'annually':
                  nextPaymentDate = addMonths(currentDate, 12);
                  periodMultiplier = 12;
                  break;
                default:
                  nextPaymentDate = addMonths(currentDate, 1);
                  periodMultiplier = 1;
              }
              
              const paymentAmount = monthlyAmount * periodMultiplier;
              console.log(`Payment schedule: Contract ${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd')}, Payment ${paymentIndex + 1} on ${format(currentDate, 'MMM dd')} for ${item.paymentPeriod} (${paymentAmount})`);
              
              const daysFromNow = differenceInDays(currentDate, new Date());
              let status: PaymentSchedule['status'] = 'due';
              
              if (daysFromNow < 0) {
                status = 'overdue';
              } else if (daysFromNow > 7) {
                status = 'due';
              }
              
              newSchedules.push({
                id: `${agreementId}-payment-${paymentIndex}`,
                agreementId,
                customer: sale.customer,
                product: item.product,
                amount: paymentAmount,
                dueDate: currentDate.toISOString().split('T')[0],
                status
              });
              
              currentDate = nextPaymentDate;
              paymentIndex++;
            }
          }
        });
    });

    if (newSchedules.length > 0) {
      setPaymentSchedules(prev => [...prev, ...newSchedules]);
    }
  }, [sales, paymentSchedules, setPaymentSchedules]);

  // Filter and sort payment schedules
  const filteredPayments = paymentSchedules
    .filter(payment => {
      const matchesSearch = searchTerm === "" || 
        payment.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.product.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const dateA = new Date(a.dueDate);
      const dateB = new Date(b.dueDate);
      
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = dateA.getTime() - dateB.getTime();
          break;
        case 'month':
          const monthA = `${dateA.getFullYear()}-${(dateA.getMonth() + 1).toString().padStart(2, '0')}`;
          const monthB = `${dateB.getFullYear()}-${(dateB.getMonth() + 1).toString().padStart(2, '0')}`;
          comparison = monthA.localeCompare(monthB);
          // If same month, sort by date within month
          if (comparison === 0) {
            comparison = dateA.getTime() - dateB.getTime();
          }
          break;
        case 'year':
          comparison = dateA.getFullYear() - dateB.getFullYear();
          // If same year, sort by date within year
          if (comparison === 0) {
            comparison = dateA.getTime() - dateB.getTime();
          }
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'due': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="h-4 w-4" />;
      case 'due': return <Clock className="h-4 w-4" />;
      case 'overdue': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const markPayment = (paymentId: string, status: PaymentSchedule['status'], paymentMethod?: string) => {
    setPaymentSchedules(prev => prev.map(payment => {
      if (payment.id === paymentId) {
        const updatedPayment = { 
          ...payment, 
          status,
          paidDate: status === 'paid' ? new Date().toISOString().split('T')[0] : undefined,
          paymentMethod: status === 'paid' ? (paymentMethod || 'cash') : undefined
        };
        
        // Save to localStorage for finance page calculations when marked as paid
        if (status === 'paid') {
          const existingPaidPayments = JSON.parse(localStorage.getItem('paid-rental-payments') || '[]');
          const paidPaymentRecord = {
            id: payment.id,
            customer: payment.customer,  
            product: payment.product,
            amount: payment.amount,
            dueDate: payment.dueDate,
            paidDate: updatedPayment.paidDate,
            paymentMethod: updatedPayment.paymentMethod,
            status: 'paid'
          };
          
          // Check if already exists to prevent duplicates
          const existingIndex = existingPaidPayments.findIndex((p: any) => p.id === payment.id);
          if (existingIndex >= 0) {
            existingPaidPayments[existingIndex] = paidPaymentRecord;
          } else {
            existingPaidPayments.push(paidPaymentRecord);
          }
          
          localStorage.setItem('paid-rental-payments', JSON.stringify(existingPaidPayments));
        } else {
          // Remove from paid payments if unmarked
          const existingPaidPayments = JSON.parse(localStorage.getItem('paid-rental-payments') || '[]');
          const filteredPayments = existingPaidPayments.filter((p: any) => p.id !== payment.id);
          localStorage.setItem('paid-rental-payments', JSON.stringify(filteredPayments));
        }
        
        return updatedPayment;
      }
      return payment;
    }));

    toast({
      title: status === 'paid' ? "Payment Recorded" : "Status Updated",
      description: status === 'paid' 
        ? `Payment has been recorded and will appear in finance calculations.`
        : `Payment status updated to ${status}.`
    });
  };

  // Calculate statistics
  const totalPayments = paymentSchedules.length;
  const paidPayments = paymentSchedules.filter(p => p.status === 'paid').length;
  const overduePayments = paymentSchedules.filter(p => p.status === 'overdue').length;
  const monthlyRevenue = paymentSchedules
    .filter(p => p.status === 'paid' && p.paidDate)
    .filter(p => {
      const paidDate = new Date(p.paidDate!);
      const now = new Date();
      return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, p) => sum + p.amount, 0);

  // Generate next 12 months and group payments by month
  const generateMonthlyView = () => {
    const months = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const monthDate = addMonths(currentDate, i);
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthPayments = filteredPayments.filter(payment => {
        const paymentDate = new Date(payment.dueDate);
        return isSameMonth(paymentDate, monthDate);
      });
      
      months.push({
        date: monthDate,
        monthKey,
        title: format(monthDate, 'MMMM yyyy'),
        payments: monthPayments,
        totalAmount: monthPayments.reduce((sum, p) => sum + p.amount, 0),
        paidAmount: monthPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
        overdueCount: monthPayments.filter(p => p.status === 'overdue').length,
        dueCount: monthPayments.filter(p => p.status === 'due').length,
        paidCount: monthPayments.filter(p => p.status === 'paid').length
      });
    }
    
    return months;
  };

  const monthlyView = generateMonthlyView();

  // Get overdue unpaid payments for special attention
  const overdueUnpaidPayments = filteredPayments.filter(p => p.status === 'overdue');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rental Payments</h1>
          <p className="text-muted-foreground">Track and manage rental payment schedules</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Total Payments
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{totalPayments}</div>
            <p className="text-xs text-muted-foreground">
              All scheduled payments
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Paid This Month
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{paidPayments}</div>
            <p className="text-xs text-muted-foreground">
              Payments received
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Overdue
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{overduePayments}</div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Monthly Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">
              ${monthlyRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              This month's collections
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Sorting */}
      <Card className="dashboard-card">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Label>Search Payments</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer or product..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="w-full md:w-48">
                <Label>Filter by Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4">
              <div className="w-full md:w-48">
                <Label>Sort By</Label>
                <Select value={sortBy} onValueChange={(value: 'date' | 'month' | 'year') => setSortBy(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Due Date</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-full md:w-48">
                <Label>Sort Order</Label>
                <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSortBy('date');
                    setSortOrder('asc');
                    setStatusFilter('all');
                    setSearchTerm('');
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Payments Alert Section */}
      {overdueUnpaidPayments.length > 0 && (
        <Card className="dashboard-card border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardHeader>
            <CardTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Overdue Payments - Immediate Action Required
            </CardTitle>
            <CardDescription className="text-red-700 dark:text-red-300">
              {overdueUnpaidPayments.length} payment{overdueUnpaidPayments.length !== 1 ? 's' : ''} overdue requiring immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overdueUnpaidPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-white dark:bg-red-900/20 dark:border-red-700">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <span className="font-medium text-red-800 dark:text-red-200">{payment.customer}</span>
                      <span className="text-red-600 dark:text-red-400">•</span>
                      <span className="text-sm text-red-700 dark:text-red-300">{payment.product}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="font-bold text-red-800 dark:text-red-200">${payment.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="text-red-700 dark:text-red-300">Due {format(new Date(payment.dueDate), 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="text-red-700 dark:text-red-300 font-medium">
                          {Math.abs(differenceInDays(new Date(payment.dueDate), new Date()))} days overdue
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700">
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        OVERDUE
                      </div>
                    </Badge>
                    
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => markPayment(payment.id, 'paid', 'cash')}
                    >
                      Mark Paid Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Payment Schedule */}
      <div className="space-y-6">
        {filteredPayments.length === 0 ? (
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Payments Found</h3>
                <p className="text-muted-foreground mb-4">
                  {paymentSchedules.length === 0 
                    ? "Payment schedules will be generated from rental agreements." 
                    : "No payments match your search criteria."
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          monthlyView.map((month) => (
            <Card key={month.monthKey} className="dashboard-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl text-card-foreground flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {month.title}
                    </CardTitle>
                    <CardDescription>
                      {month.payments.length} payment{month.payments.length !== 1 ? 's' : ''} scheduled
                      {month.totalAmount > 0 && ` • $${month.totalAmount.toFixed(2)} total`}
                    </CardDescription>
                  </div>
                  {month.payments.length > 0 && (
                    <div className="flex gap-2">
                      {month.paidCount > 0 && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {month.paidCount} paid
                        </Badge>
                      )}
                      {month.dueCount > 0 && (
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {month.dueCount} due
                        </Badge>
                      )}
                      {month.overdueCount > 0 && (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          {month.overdueCount} overdue
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              
              {month.payments.length > 0 && (
                <CardContent>
                  <div className="space-y-3">
                    {month.payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg bg-card/50">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-card-foreground">{payment.customer}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground">{payment.product}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="font-bold text-card-foreground">${payment.amount.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Due {format(new Date(payment.dueDate), 'MMM dd')}</span>
                            </div>
                            {payment.paidDate && (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-muted-foreground">Paid {format(new Date(payment.paidDate), 'MMM dd')}</span>
                              </div>
                            )}
                            {payment.paymentMethod && (
                              <Badge variant="outline" className="text-xs">{payment.paymentMethod}</Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Badge className={getStatusColor(payment.status)}>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(payment.status)}
                              {payment.status}
                            </div>
                          </Badge>
                          
                          {payment.status !== 'paid' ? (
                            <Button
                              size="sm"
                              onClick={() => markPayment(payment.id, 'paid', 'cash')}
                            >
                              Mark Paid
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markPayment(payment.id, 'due')}
                            >
                              Mark Unpaid
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
              
              {month.payments.length === 0 && (
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No payments scheduled for this month</p>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}