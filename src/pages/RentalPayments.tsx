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
import { format, addMonths, addDays, differenceInDays, parseISO } from "date-fns";

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
            
            while (currentDate <= endDate) {
              let nextPaymentDate: Date;
              
              switch (item.paymentPeriod) {
                case 'monthly':
                  nextPaymentDate = addMonths(currentDate, 1);
                  break;
                case 'quarterly':
                  nextPaymentDate = addMonths(currentDate, 3);
                  break;
                case 'biannually':
                  nextPaymentDate = addMonths(currentDate, 6);
                  break;
                case 'annually':
                  nextPaymentDate = addMonths(currentDate, 12);
                  break;
                default:
                  nextPaymentDate = addMonths(currentDate, 1);
              }
              
              // Don't create payment past the end date
              if (currentDate > endDate) break;
              
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
                amount: monthlyAmount,
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

  // Filter payment schedules
  const filteredPayments = paymentSchedules.filter(payment => {
    const matchesSearch = searchTerm === "" || 
      payment.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.product.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
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
    setPaymentSchedules(prev => prev.map(payment => 
      payment.id === paymentId 
        ? { 
            ...payment, 
            status,
            paidDate: status === 'paid' ? new Date().toISOString().split('T')[0] : undefined,
            paymentMethod: status === 'paid' ? (paymentMethod || 'cash') : undefined
          }
        : payment
    ));

    toast({
      title: status === 'paid' ? "Payment Recorded" : "Status Updated",
      description: `Payment status updated to ${status}.`
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

      {/* Filters */}
      <Card className="dashboard-card">
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>

      {/* Payment Schedule Table */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-card-foreground">Payment Schedule</CardTitle>
          <CardDescription>
            Track rental payment due dates and payment status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
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
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {payment.customer}
                        </div>
                      </TableCell>
                      <TableCell>{payment.product}</TableCell>
                      <TableCell className="font-bold">${payment.amount.toFixed(2)}</TableCell>
                      <TableCell>{format(new Date(payment.dueDate), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(payment.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(payment.status)}
                            {payment.status}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {payment.paidDate ? format(new Date(payment.paidDate), 'MMM dd, yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        {payment.paymentMethod ? (
                          <Badge variant="outline">{payment.paymentMethod}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {payment.status !== 'paid' ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => markPayment(payment.id, 'paid', 'cash')}
                            >
                              Mark Paid
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markPayment(payment.id, 'due')}
                          >
                            Mark Unpaid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}