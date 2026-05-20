import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Settings2, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAccountMappings, Workflow } from '@/hooks/useAccountMappings';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';

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
      { key: 'accounts_receivable', label: 'Accounts Receivable',  hint: 'Amount owed by the customer', fallback: '1100_accounts_receivable', side: 'DR', acceptTypes: ['asset'] },
      { key: 'sales_revenue',       label: 'Sales Revenue',        hint: 'Net revenue from the sale',   fallback: '4000_sales_revenue',       side: 'CR', acceptTypes: ['revenue'] },
      { key: 'output_vat',          label: 'Output VAT',           hint: 'VAT collected from customer', fallback: '2300_vat_payable',         side: 'CR', acceptTypes: ['liability'] },
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Account Mappings</h1>
          <p className="text-muted-foreground">
            Choose which Chart of Accounts entry the system posts to for each accounting workflow.
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Settings2 className="h-3.5 w-3.5 mr-1.5" />
          {configuredCount} of {totalRoles} roles configured
        </Badge>
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
