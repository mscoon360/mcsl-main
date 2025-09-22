import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Calendar, DollarSign, User } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { format } from "date-fns";

interface RentalAgreement {
  id: string;
  customer: string;
  product: string;
  contractLength: string;
  paymentPeriod: string;
  startDate: Date;
  endDate: Date;
  monthlyAmount: number;
  totalValue: number;
  status: 'active' | 'expired' | 'cancelled';
  saleId: string;
  saleDate: string;
}

export default function RentalAgreements() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Get sales data and filter for rental agreements
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

  // Extract rental agreements from sales data
  const rentalAgreements: RentalAgreement[] = sales.flatMap(sale => 
    sale.items
      .filter(item => item.isRental && item.startDate && item.endDate)
      .map(item => ({
        id: `${sale.id}-${item.product}`,
        customer: sale.customer,
        product: item.product,
        contractLength: item.contractLength || '',
        paymentPeriod: item.paymentPeriod || 'monthly',
        startDate: new Date(item.startDate!),
        endDate: new Date(item.endDate!),
        monthlyAmount: item.price,
        totalValue: item.price * item.quantity,
        status: new Date(item.endDate!) > new Date() ? 'active' : 'expired' as 'active' | 'expired',
        saleId: sale.id,
        saleDate: sale.date
      }))
  );

  // Filter agreements based on search term
  const filteredAgreements = rentalAgreements.filter(agreement =>
    agreement.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agreement.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agreement.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'expired': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const activeAgreements = rentalAgreements.filter(a => a.status === 'active').length;
  const totalMonthlyRevenue = rentalAgreements
    .filter(a => a.status === 'active')
    .reduce((sum, a) => sum + a.monthlyAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rental Agreements</h1>
          <p className="text-muted-foreground">Manage and track all rental agreements</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Active Agreements
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{activeAgreements}</div>
            <p className="text-xs text-muted-foreground">
              Currently active rentals
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
              ${totalMonthlyRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              From active agreements
            </p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              Total Agreements
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-card-foreground">{rentalAgreements.length}</div>
            <p className="text-xs text-muted-foreground">
              All time agreements
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rental Agreements Table */}
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground">Rental Agreements Log</CardTitle>
              <CardDescription>
                All rental agreements and their current status
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search agreements..." 
                className="w-64" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAgreements.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Rental Agreements Found</h3>
              <p className="text-muted-foreground mb-4">
                {rentalAgreements.length === 0 
                  ? "Create your first rental agreement in the Sales Log." 
                  : "No agreements match your search criteria."
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
                    <TableHead>Contract Length</TableHead>
                    <TableHead>Payment Period</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Monthly Amount</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgreements.map((agreement) => (
                    <TableRow key={agreement.id}>
                      <TableCell className="font-medium">
                        {agreement.customer}
                      </TableCell>
                      <TableCell>{agreement.product}</TableCell>
                      <TableCell>{agreement.contractLength}</TableCell>
                      <TableCell className="capitalize">{agreement.paymentPeriod}</TableCell>
                      <TableCell>{format(agreement.startDate, 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{format(agreement.endDate, 'MMM dd, yyyy')}</TableCell>
                      <TableCell>${agreement.monthlyAmount.toFixed(2)}</TableCell>
                      <TableCell>${agreement.totalValue.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(agreement.status)}>
                          {agreement.status}
                        </Badge>
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