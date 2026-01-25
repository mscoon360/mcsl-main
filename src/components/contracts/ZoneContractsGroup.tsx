import { useMemo, useState } from "react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, MapPin } from "lucide-react";
import { RenewalContract } from "@/hooks/useRenewalContracts";
import { RenewalContractRow } from "./RenewalContractRow";
import { cn } from "@/lib/utils";

interface ZoneContractsGroupProps {
  zone: string;
  contracts: RenewalContract[];
  onDelete: (id: string) => void;
  defaultOpen?: boolean;
}

export function ZoneContractsGroup({ zone, contracts, onDelete, defaultOpen = false }: ZoneContractsGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const zoneStats = useMemo(() => ({
    total: contracts.length,
    expiringSoon: contracts.filter(c => c.status === 'expiring-soon').length,
    recentlyExpired: contracts.filter(c => c.status === 'recently-expired').length,
    totalValue: contracts.reduce((sum, c) => sum + (c.value_of_contract_vat || 0), 0)
  }), [contracts]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg mb-4">
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-t-lg">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold text-foreground">{zone}</span>
            <Badge variant="secondary">{zoneStats.total} contracts</Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-3 text-sm">
              {zoneStats.expiringSoon > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400">
                  {zoneStats.expiringSoon} expiring
                </span>
              )}
              {zoneStats.recentlyExpired > 0 && (
                <span className="text-destructive">
                  {zoneStats.recentlyExpired} expired
                </span>
              )}
              <span className="text-muted-foreground">
                ${zoneStats.totalValue.toFixed(2)}/yr
              </span>
            </div>
            <ChevronDown className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4">
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Contract Start</TableHead>
                  <TableHead>Contract End</TableHead>
                  <TableHead>Yearly Value</TableHead>
                  <TableHead>Type of Billing</TableHead>
                  <TableHead>Type of Service</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <RenewalContractRow 
                    key={contract.id} 
                    contract={contract} 
                    onDelete={onDelete}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
