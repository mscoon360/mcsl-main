import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, Clock, Phone, Mail, Upload, Trash2 } from "lucide-react";
import { useRenewalContracts } from "@/hooks/useRenewalContracts";
import { ImportRenewalListDialog } from "./ImportRenewalListDialog";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export function RenewalListSection() {
  const { contracts, stats, refetch, loading } = useRenewalContracts();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { toast } = useToast();

  const getStatusBadge = (status: string, daysUntilExpiry: number, daysSinceExpiry: number) => {
    if (status === 'recently-expired') {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Expired {daysSinceExpiry}d ago
        </Badge>
      );
    }
    
    if (status === 'expired') {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          Expired
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
    
    if (daysUntilExpiry <= 60) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {daysUntilExpiry}d left
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="flex items-center gap-1">
        Active
      </Badge>
    );
  };

  const getUrgencyColor = (status: string, daysUntilExpiry: number) => {
    if (status === 'recently-expired') return 'border-l-4 border-l-destructive';
    if (status === 'expiring-soon' && daysUntilExpiry <= 14) return 'border-l-4 border-l-orange-500';
    if (status === 'expiring-soon') return 'border-l-4 border-l-yellow-500';
    return '';
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('renewal_contracts')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete contract",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Deleted",
        description: "Contract removed from renewal list",
      });
      refetch();
    }
  };

  // Filter to show only actionable contracts (expiring soon or recently expired)
  const actionableContracts = contracts.filter(c => 
    c.status === 'expiring-soon' || c.status === 'recently-expired'
  );

  if (contracts.length === 0 && !loading) {
    return (
      <>
        <Card className="dashboard-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                <CardTitle className="text-card-foreground">Renewal List</CardTitle>
              </div>
              <Button onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </div>
            <CardDescription>
              Contracts requiring follow-up for renewal approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Contracts Imported</h3>
              <p className="text-muted-foreground mb-4">
                Import your renewal list spreadsheet to track contracts requiring follow-up.
              </p>
              <Button onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import Spreadsheet
              </Button>
            </div>
          </CardContent>
        </Card>
        <ImportRenewalListDialog 
          open={importDialogOpen} 
          onOpenChange={setImportDialogOpen}
          onSuccess={refetch}
        />
      </>
    );
  }

  return (
    <>
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
            <div className="flex items-center gap-4">
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
                  <div className="text-sm text-muted-foreground">Total Value</div>
                  <div className="text-xl font-bold text-card-foreground">${stats.totalValue.toFixed(2)}</div>
                </div>
              </div>
              <Button onClick={() => setImportDialogOpen(true)} variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
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
                  <TableHead>Value (VAT)</TableHead>
                  <TableHead>Type of Billing</TableHead>
                  <TableHead>Type of Service</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actionableContracts.map((contract) => (
                  <TableRow key={contract.id} className={getUrgencyColor(contract.status, contract.daysUntilExpiry)}>
                    <TableCell className="font-medium">{contract.client}</TableCell>
                    <TableCell>
                      {contract.contract_start_date 
                        ? format(new Date(contract.contract_start_date), 'dd/MM/yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {contract.contract_end_date 
                        ? format(new Date(contract.contract_end_date), 'dd/MM/yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>${(contract.value_of_contract_vat || 0).toFixed(2)}</TableCell>
                    <TableCell className="capitalize">{contract.type_of_billing || '-'}</TableCell>
                    <TableCell>{contract.type_of_service || '-'}</TableCell>
                    <TableCell>{contract.zone || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-xs">
                        {contract.contact_number && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {contract.contact_number}
                          </span>
                        )}
                        {contract.email && (
                          <span className="flex items-center gap-1 text-muted-foreground truncate max-w-[150px]">
                            <Mail className="h-3 w-3" /> {contract.email}
                          </span>
                        )}
                        {!contract.contact_number && !contract.email && '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(contract.status, contract.daysUntilExpiry, contract.daysSinceExpiry)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {contract.contact_number && (
                          <Button variant="ghost" size="sm" title="Call" asChild>
                            <a href={`tel:${contract.contact_number}`}>
                              <Phone className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {contract.email && (
                          <Button variant="ghost" size="sm" title="Email" asChild>
                            <a href={`mailto:${contract.email}?subject=Contract Renewal - ${contract.type_of_service || 'Service'}`}>
                              <Mail className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="Delete"
                          onClick={() => handleDelete(contract.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {actionableContracts.length === 0 && contracts.length > 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>All imported contracts are up to date!</p>
              <p className="text-sm mt-1">Total contracts in list: {contracts.length}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <ImportRenewalListDialog 
        open={importDialogOpen} 
        onOpenChange={setImportDialogOpen}
        onSuccess={refetch}
      />
    </>
  );
}
