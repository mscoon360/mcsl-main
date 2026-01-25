import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Phone, Mail, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { RenewalContract } from "@/hooks/useRenewalContracts";

interface RenewalContractRowProps {
  contract: RenewalContract;
  onDelete: (id: string) => void;
}

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

const getPaymentDue = (yearlyValue: number, billingType: string | null): { amount: number; label: string } => {
  const type = billingType?.toLowerCase() || '';
  
  if (type.includes('quarterly')) {
    return { amount: yearlyValue / 4, label: '/quarter' };
  }
  if (type.includes('monthly')) {
    return { amount: yearlyValue / 12, label: '/month' };
  }
  if (type.includes('bi-monthly')) {
    return { amount: yearlyValue / 6, label: '/bi-month' };
  }
  if (type.includes('weekly')) {
    return { amount: yearlyValue / 52, label: '/week' };
  }
  // Yearly or unknown - show yearly
  return { amount: yearlyValue, label: '/yr' };
};

export function RenewalContractRow({ contract, onDelete }: RenewalContractRowProps) {
  const paymentDue = getPaymentDue(contract.value_of_contract_vat || 0, contract.type_of_billing);
  
  return (
    <TableRow className={getUrgencyColor(contract.status, contract.daysUntilExpiry)}>
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
      <TableCell>${(contract.value_of_contract_vat || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/yr</TableCell>
      <TableCell className="capitalize">{contract.type_of_billing || '-'}</TableCell>
      <TableCell className="font-medium text-primary">${paymentDue.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{paymentDue.label}</TableCell>
      <TableCell>{contract.type_of_service || '-'}</TableCell>
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
            onClick={() => onDelete(contract.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
