import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Upload } from "lucide-react";
import { useRenewalContracts } from "@/hooks/useRenewalContracts";
import { ImportRenewalListDialog } from "./ImportRenewalListDialog";
import { ZoneContractsGroup } from "./ZoneContractsGroup";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export function RenewalListSection() {
  const { contracts, stats, refetch, loading } = useRenewalContracts();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { toast } = useToast();

  // Group contracts by zone
  const contractsByZone = useMemo(() => {
    const grouped = new Map<string, typeof contracts>();
    
    contracts.forEach(contract => {
      const zone = contract.zone || 'Unassigned';
      if (!grouped.has(zone)) {
        grouped.set(zone, []);
      }
      grouped.get(zone)!.push(contract);
    });

    // Sort zones alphabetically, but put "Unassigned" at the end
    const sortedZones = Array.from(grouped.entries()).sort(([a], [b]) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    });

    return sortedZones;
  }, [contracts]);

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
                Contracts grouped by zone - yearly contract values shown
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
                  <div className="text-sm text-muted-foreground">Total Yearly Value</div>
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
          {contractsByZone.map(([zone, zoneContracts]) => (
            <ZoneContractsGroup
              key={zone}
              zone={zone}
              contracts={zoneContracts}
              onDelete={handleDelete}
              defaultOpen={contractsByZone.length === 1}
            />
          ))}
          {contracts.length > 0 && contractsByZone.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>All contracts are up to date!</p>
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
