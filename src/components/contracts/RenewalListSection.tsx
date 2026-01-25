import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, Clock, Phone, Mail } from "lucide-react";
import { useRenewalList } from "@/hooks/useRenewalList";
import { format } from "date-fns";

export function RenewalListSection() {
  const { renewalList, stats } = useRenewalList();

  const getStatusBadge = (status: 'expiring-soon' | 'recently-expired', daysUntilExpiry: number, daysSinceExpiry: number) => {
    if (status === 'recently-expired') {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Expired {daysSinceExpiry}d ago
        </Badge>
      );
    }
    
    if (daysUntilExpiry <= 14) {
      return (
        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {daysUntilExpiry}d left
        </Badge>
      );
    }
    
    return (
      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {daysUntilExpiry}d left
      </Badge>
    );
  };

  const getUrgencyColor = (status: 'expiring-soon' | 'recently-expired', daysUntilExpiry: number) => {
    if (status === 'recently-expired') return 'border-l-4 border-l-destructive';
    if (daysUntilExpiry <= 14) return 'border-l-4 border-l-orange-500';
    return 'border-l-4 border-l-yellow-500';
  };

  if (renewalList.length === 0) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <CardTitle className="text-card-foreground">Renewal List</CardTitle>
          </div>
          <CardDescription>
            Contracts requiring follow-up for renewal approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Renewals Pending</h3>
            <p className="text-muted-foreground">
              All contracts are up to date. Contracts expiring within 60 days or recently expired will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              <CardTitle className="text-card-foreground">Renewal List</CardTitle>
            </div>
            <CardDescription>
              Contracts requiring follow-up for renewal approval
            </CardDescription>
          </div>
          <div className="flex gap-3">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Expiring Soon</div>
              <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{stats.expiringSoon}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Recently Expired</div>
              <div className="text-xl font-bold text-destructive">{stats.recentlyExpired}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Monthly Value at Risk</div>
              <div className="text-xl font-bold text-card-foreground">${stats.totalMonthlyValue.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contract Start</TableHead>
                <TableHead>Contract End</TableHead>
                <TableHead>Value of Contract (VAT)</TableHead>
                <TableHead>Type of Billing</TableHead>
                <TableHead>Type of Service</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renewalList.map((contract) => (
                <TableRow key={contract.id} className={getUrgencyColor(contract.status, contract.daysUntilExpiry)}>
                  <TableCell className="font-medium">{contract.customer}</TableCell>
                  <TableCell>{format(contract.startDate, 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{format(contract.endDate, 'dd/MM/yyyy')}</TableCell>
                  <TableCell>${contract.totalValue.toFixed(2)}</TableCell>
                  <TableCell className="capitalize">{contract.paymentPeriod}</TableCell>
                  <TableCell>{contract.product}</TableCell>
                  <TableCell>{contract.zone || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-xs">
                      {contract.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {contract.phone}
                        </span>
                      )}
                      {contract.email && (
                        <span className="flex items-center gap-1 text-muted-foreground truncate max-w-[150px]">
                          <Mail className="h-3 w-3" /> {contract.email}
                        </span>
                      )}
                      {!contract.phone && !contract.email && '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(contract.status, contract.daysUntilExpiry, contract.daysSinceExpiry)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {contract.phone && (
                        <Button variant="ghost" size="sm" title="Call customer" asChild>
                          <a href={`tel:${contract.phone}`}>
                            <Phone className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {contract.email && (
                        <Button variant="ghost" size="sm" title="Email customer" asChild>
                          <a href={`mailto:${contract.email}?subject=Contract Renewal - ${contract.product}`}>
                            <Mail className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
