import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Upload, Users, Loader2 } from "lucide-react";
import { useRenewalContracts } from "@/hooks/useRenewalContracts";
import { ImportRenewalListDialog } from "./ImportRenewalListDialog";
import { ZoneContractsGroup } from "./ZoneContractsGroup";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export function RenewalListSection() {
  const { contracts, stats, refetch, loading } = useRenewalContracts();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [syncingCustomers, setSyncingCustomers] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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

  const handleUpdateValue = async (id: string, newValue: number) => {
    const { error } = await supabase
      .from('renewal_contracts')
      .update({ value_of_contract_vat: newValue })
      .eq('id', id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update contract value",
        variant: "destructive",
      });
      throw error;
    } else {
      toast({
        title: "Updated",
        description: "Contract value updated successfully",
      });
      refetch();
    }
  };

  const syncCustomersFromContracts = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to sync customers",
        variant: "destructive",
      });
      return;
    }

    setSyncingCustomers(true);
    let added = 0;
    let skipped = 0;

    try {
      // Get existing customers to check for duplicates by company name
      const { data: existingCustomers, error: fetchError } = await supabase
        .from('customers')
        .select('company');

      if (fetchError) throw fetchError;

      const existingCompanies = new Set(
        (existingCustomers || [])
          .map(c => c.company?.toLowerCase().trim())
          .filter(Boolean)
      );

      // Get unique clients from contracts
      const uniqueClients = new Map<string, typeof contracts[0]>();
      contracts.forEach(contract => {
        const clientKey = contract.client.toLowerCase().trim();
        if (!uniqueClients.has(clientKey)) {
          uniqueClients.set(clientKey, contract);
        }
      });

      // Insert new customers
      for (const [clientKey, contract] of uniqueClients) {
        if (existingCompanies.has(clientKey)) {
          skipped++;
          continue;
        }

        const { error: insertError } = await supabase
          .from('customers')
          .insert({
            user_id: user.id,
            company: contract.client,
            name: null, // Representative name - to be added later
            phone: contract.contact_number || null,
            email: contract.email || null,
            zone: contract.zone || null,
            status: 'active',
            vatable: true, // Default to vatable
            total_contract_value: contract.value_of_contract_vat || 0,
          });

        if (insertError) {
          console.error('Error inserting customer:', contract.client, insertError);
        } else {
          added++;
          existingCompanies.add(clientKey); // Prevent duplicates within same batch
        }
      }

      toast({
        title: "Customers Synced",
        description: `Added ${added} new customers. ${skipped} already existed.`,
      });
    } catch (error) {
      console.error('Error syncing customers:', error);
      toast({
        title: "Error",
        description: "Failed to sync customers from contracts",
        variant: "destructive",
      });
    } finally {
      setSyncingCustomers(false);
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
              <Button 
                onClick={syncCustomersFromContracts} 
                variant="outline"
                disabled={syncingCustomers}
              >
                {syncingCustomers ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                Sync Customers
              </Button>
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
              onUpdateValue={handleUpdateValue}
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
