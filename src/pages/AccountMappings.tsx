import { useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Settings2, X, Download } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAccountMappings, Workflow } from '@/hooks/useAccountMappings';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { useLedgerEntries } from '@/hooks/useLedgerEntries';
import { useToast } from '@/hooks/use-toast';


interface Role {
  key: string;
  label: string;
  hint: string;
  fallback: string;
  side: 'DR' | 'CR';
  acceptTypes: Array<'asset' | 'liability' | 'equity' | 'revenue' | 'expense'>;
}

interface WorkflowGroup {
  workflow: Workflow;
  title: string;
  description: string;
  status: 'active' | 'pending';
  roles: Role[];
}

const WORKFLOWS: WorkflowGroup[] = [
  {
    workflow: 'sale',
    title: 'Sales',
    description: 'Posted when a sale is recorded as completed.',
    status: 'active',
    roles: [
      { key: 'accounts_receivable', label: 'Accounts Receivable',  hint: 'Amount owed by the customer',                                fallback: '1100_accounts_receivable', side: 'DR', acceptTypes: ['asset'] },
      { key: 'sales_revenue',       label: 'Sales Revenue',        hint: 'Net revenue from the sale',                                  fallback: '4000_sales_revenue',       side: 'CR', acceptTypes: ['revenue'] },
      { key: 'output_vat',          label: 'Output VAT',           hint: 'VAT collected from customer',                                fallback: '2300_vat_payable',         side: 'CR', acceptTypes: ['liability'] },
      { key: 'inventory',           label: 'Inventory',            hint: 'Asset credited per item when COGS is posted on a sale',      fallback: '1001_inventory',           side: 'CR', acceptTypes: ['asset'] },
    ],
  },
  {
    workflow: 'expense',
    title: 'Expenses',
    description: 'Posted when an expense is recorded. The expense account depends on the category.',
    status: 'active',
    roles: [
      { key: 'cash_bank',                label: 'Cash / Bank',                 hint: 'Account credited for the cash outflow',    fallback: '1000_cash_bank',           side: 'CR', acceptTypes: ['asset'] },
      { key: 'input_vat',                label: 'Input VAT',                   hint: 'Recoverable VAT on purchases',              fallback: '1200_vat_receivable',      side: 'DR', acceptTypes: ['asset'] },
      { key: 'working_capital_expense',  label: 'Working Capital Expense',     hint: 'Used when expense category = working-capital', fallback: '5100_operating_expenses', side: 'DR', acceptTypes: ['expense'] },
      { key: 'fixed_capital_expense',    label: 'Fixed Capital Expense',       hint: 'Used when expense category = fixed-capital',   fallback: '5200_capital_expenses',   side: 'DR', acceptTypes: ['expense'] },
      { key: 'general_expense',          label: 'General Expense',             hint: 'Used when no category is set',                 fallback: '5000_general_expenses',   side: 'DR', acceptTypes: ['expense'] },
    ],
  },
  {
    workflow: 'payment',
    title: 'Payments',
    description: 'Posted when a payment schedule is marked as paid.',
    status: 'active',
    roles: [
      { key: 'cash_bank',           label: 'Cash / Bank',          hint: 'Account debited when cash is received', fallback: '1000_cash_bank',           side: 'DR', acceptTypes: ['asset'] },
      { key: 'accounts_receivable', label: 'Accounts Receivable',  hint: 'AR account being settled',              fallback: '1100_accounts_receivable', side: 'CR', acceptTypes: ['asset'] },
    ],
  },
  {
    workflow: 'refund',
    title: 'Refunds & Adjustments',
    description: 'Posted when a refund or invoice adjustment is recorded. (Triggers not yet implemented — mapping is saved for when they are.)',
    status: 'pending',
    roles: [
      { key: 'sales_revenue', label: 'Sales Revenue',  hint: 'Revenue account to reverse', fallback: '4000_sales_revenue', side: 'DR', acceptTypes: ['revenue'] },
      { key: 'output_vat',    label: 'Output VAT',     hint: 'VAT account to reverse',     fallback: '2300_vat_payable',   side: 'DR', acceptTypes: ['liability'] },
      { key: 'cash_bank',     label: 'Cash / Bank',    hint: 'Account credited on refund', fallback: '1000_cash_bank',     side: 'CR', acceptTypes: ['asset'] },
    ],
  },
];

export default function AccountMappings() {
  const { accounts, loading: accountsLoading } = useChartOfAccounts();
  const { mappings, loading: mappingsLoading, upsertMapping, clearMapping, get } = useAccountMappings();
  const { entries, loading: ledgerLoading } = useLedgerEntries();
  const { toast } = useToast();

  const accountsByType = useMemo(() => {
    const sorted = [...accounts]
      .filter(a => a.is_active)
      .sort((a, b) => a.account_number.localeCompare(b.account_number));
    return sorted;
  }, [accounts]);

  const accountsFor = (types: Role['acceptTypes']) =>
    accountsByType.filter(a => types.includes(a.account_type as any));

  const configuredCount = mappings.length;
  const totalRoles = WORKFLOWS.reduce((s, w) => s + w.roles.length, 0);

  const accountName = (code: string) =>
    accounts.find(a => a.account_number === code)?.account_name ?? '';
  const accountType = (code: string) =>
    accounts.find(a => a.account_number === code)?.account_type ?? '';

  const handleExport = () => {
    try {
      // Every account code involved in the mappings (mapped or fallback)
      const roleRows = WORKFLOWS.flatMap(group =>
        group.roles.map(role => {
          const mapped = get(group.workflow, role.key);
          const effective = mapped || role.fallback;
          return {
            Workflow: group.title,
            Role: role.label,
            Side: role.side,
            'Mapped Account': mapped || '(fallback)',
            'Effective Account Code': effective,
            'Account Name': accountName(effective),
            'Account Type': accountType(effective),
            Status: group.status === 'active' ? 'Live' : 'Saved for later',
          };
        })
      );

      const codes = Array.from(new Set(roleRows.map(r => r['Effective Account Code'])));

      // Flatten every ledger line that touches one of these accounts
      const ledgerRows: Record<string, any>[] = [];
      entries.forEach(entry => {
        (entry.entries || []).forEach((line: any) => {
          if (!codes.includes(line.account_code)) return;
          ledgerRows.push({
            Date: entry.posted_at ? new Date(entry.posted_at).toLocaleDateString() : '',
            'Account Code': line.account_code,
            'Account Name': accountName(line.account_code),
            'Account Type': accountType(line.account_code),
            'Source Type': entry.source_type,
            'Transaction ID': entry.transaction_id,
            Status: entry.status,
            Memo: line.memo ?? '',
            Currency: line.currency ?? 'USD',
            Debit: Number(line.debit || 0),
            Credit: Number(line.credit || 0),
            'Entry Total Debit': Number(entry.total_debit || 0),
            'Entry Total Credit': Number(entry.total_credit || 0),
            Details: line.meta ? JSON.stringify(line.meta) : '',
          });
        });
      });
      ledgerRows.sort((a, b) =>
        String(a['Account Code']).localeCompare(String(b['Account Code'])) ||
        new Date(a.Date).getTime() - new Date(b.Date).getTime()
      );

      // Per-account summary with running balance
      const summaryRows = codes.map(code => {
        const lines = ledgerRows.filter(r => r['Account Code'] === code && r.Status === 'posted');
        const debit = lines.reduce((s, r) => s + r.Debit, 0);
        const credit = lines.reduce((s, r) => s + r.Credit, 0);
        return {
          'Account Code': code,
          'Account Name': accountName(code),
          'Account Type': accountType(code),
          'In Chart of Accounts': accountName(code) ? 'Yes' : 'No',
          Transactions: lines.length,
          'Total Debit': debit,
          'Total Credit': credit,
          Balance: debit - credit,
        };
      }).sort((a, b) => a['Account Code'].localeCompare(b['Account Code']));

      const wb = XLSX.utils.book_new();
      const add = (name: string, rows: Record<string, any>[], widths: number[]) => {
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No data' }]);
        ws['!cols'] = widths.map(w => ({ width: w }));
        XLSX.utils.book_append_sheet(wb, ws, name);
      };

      add('Summary', summaryRows, [22, 30, 16, 18, 14, 14, 14, 14]);
      add('Ledger Lines', ledgerRows, [12, 22, 28, 14, 14, 24, 10, 40, 10, 14, 14, 16, 16, 30]);
      add('Mappings', roleRows, [18, 26, 8, 24, 24, 28, 14, 16]);

      XLSX.writeFile(wb, `account_mappings_ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Export complete', description: `${ledgerRows.length} ledger lines across ${codes.length} accounts.` });
    } catch (error: any) {
      console.error('Export failed:', error);
      toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Account Mappings</h1>
          <p className="text-muted-foreground">
            Choose which Chart of Accounts entry the system posts to for each accounting workflow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExport} disabled={ledgerLoading || accountsLoading}>
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
          <Badge variant="outline" className="text-sm">
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            {configuredCount} of {totalRoles} roles configured
          </Badge>
        </div>
      </div>


      {accounts.length === 0 && !accountsLoading && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No accounts yet</AlertTitle>
          <AlertDescription>
            You need to create accounts in your Chart of Accounts before you can map workflows.
            Visit the Chart of Accounts page to add accounts first.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>How this works</AlertTitle>
        <AlertDescription>
          When a sale, expense, or payment is recorded, the system posts double-entry journals using
          the accounts you choose below. If a role is left unmapped, the system falls back to a default
          account code — but the journal won't roll up into your Chart of Accounts unless an account
          with that code exists.
        </AlertDescription>
      </Alert>

      {WORKFLOWS.map(group => (
        <Card key={group.workflow}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>{group.title}</CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </div>
              <Badge variant={group.status === 'active' ? 'default' : 'secondary'}>
                {group.status === 'active' ? 'Live' : 'Saved for later'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.roles.map(role => {
              const current = get(group.workflow, role.key);
              const options = accountsFor(role.acceptTypes);
              return (
                <div key={role.key} className="grid grid-cols-1 md:grid-cols-[1fr,420px] gap-3 items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{role.label}</span>
                      <Badge variant="outline" className="text-xs">{role.side}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{role.hint}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      Fallback code: {role.fallback}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={current || ''}
                      onValueChange={(v) => upsertMapping(group.workflow, role.key, v)}
                      disabled={mappingsLoading || accountsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="— Use fallback —" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No {role.acceptTypes.join('/')} accounts available
                          </div>
                        ) : options.map(a => (
                          <SelectItem key={a.id} value={a.account_number}>
                            <span className="font-mono text-xs">{a.account_number}</span>
                            {' — '}
                            {a.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {current && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => clearMapping(group.workflow, role.key)}
                        title="Clear mapping (use fallback)"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
