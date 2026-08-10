import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Settings2, X, Download, CalendarIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAccountMappings, Workflow } from '@/hooks/useAccountMappings';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { useLedgerEntries } from '@/hooks/useLedgerEntries';
import { useToast } from '@/hooks/use-toast';
import { useProductAccountMappings } from '@/hooks/useProductAccountMappings';
import { useProducts } from '@/hooks/useProducts';
import { ProductAccountMappingsSection } from '@/components/finance/ProductAccountMappingsSection';
import { cn } from '@/lib/utils';


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

interface DatePickerProps {
  value?: Date;
  onChange: (date?: Date) => void;
  placeholder?: string;
}

function DatePicker({ value, onChange, placeholder = 'Pick a date' }: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[140px] justify-start text-left font-normal',
            !value && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="h-4 w-4 mr-2" />
          {value ? format(value, 'PP') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
}

export default function AccountMappings() {
  const { accounts, loading: accountsLoading } = useChartOfAccounts();
  const { mappings, loading: mappingsLoading, upsertMapping, clearMapping, get } = useAccountMappings();
  const { entries, loading: ledgerLoading } = useLedgerEntries();
  const { mappings: productMappings } = useProductAccountMappings();
  const { products } = useProducts();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();



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

  const SYSTEM_ACCOUNTS: Record<string, { name: string; type: string }> = {
    '1000_cash_bank': { name: 'Cash / Bank', type: 'asset' },
    '1001_inventory': { name: 'Inventory', type: 'asset' },
    '1100_accounts_receivable': { name: 'Accounts Receivable', type: 'asset' },
    '1200_vat_receivable': { name: 'VAT Receivable (Input VAT)', type: 'asset' },
    '2300_vat_payable': { name: 'VAT Payable (Output VAT)', type: 'liability' },
    '4000_sales_revenue': { name: 'Sales Revenue', type: 'revenue' },
    '5000_cost_of_goods_sold': { name: 'Cost of Goods Sold', type: 'expense' },
    '5000_general_expenses': { name: 'General Expenses', type: 'expense' },
    '5100_operating_expenses': { name: 'Operating Expenses', type: 'expense' },
    '5200_capital_expenses': { name: 'Capital Expenses', type: 'expense' },
  };

  const accountName = (code: string) =>
    accounts.find(a => a.account_number === code)?.account_name ?? SYSTEM_ACCOUNTS[code]?.name ?? '';
  const accountType = (code: string) =>
    accounts.find(a => a.account_number === code)?.account_type ?? SYSTEM_ACCOUNTS[code]?.type ?? '';


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

      // COGS accounts (per-product or subtype-based) are posted by the sale trigger
      // but have no mapping role — include them so the ledger is complete.
      const cogsCodes = accounts
        .filter(a => a.account_subtype === 'cost-of-goods-sold' || !!a.cogs_kind)
        .map(a => a.account_number);

      // Any ledger line that looks like a COGS posting even if the account isn't in the CoA
      const ledgerCogsCodes = entries.flatMap(e =>
        (e.entries || [])
          .map((l: any) => String(l.account_code || ''))
          .filter((c: string) => /cogs|cost_of_goods/i.test(c))
      );

      // Accounts assigned directly to products (invoiced revenue + COGS)
      const productCodes = productMappings.flatMap(m =>
        [m.revenue_account_code, m.cogs_account_code, m.inventory_account_code].filter(Boolean) as string[]
      );

      const codes = Array.from(new Set([
        ...roleRows.map(r => r['Effective Account Code']),
        ...cogsCodes,
        ...ledgerCogsCodes,
        ...productCodes,
      ]));



      // Include every account that actually has ledger activity, so nothing is dropped
      const activityCodes = entries.flatMap(e => (e.entries || []).map((l: any) => String(l.account_code || '')));
      const allCodes = Array.from(new Set([...codes, ...activityCodes].filter(Boolean)));

      const isoDate = (v?: string) => (v ? new Date(v).toISOString().split('T')[0] : '');
      const dateInRange = (v?: string) => {
        if (!startDate && !endDate) return true;
        if (!v) return false;
        const d = new Date(v);
        if (startDate && d < new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())) return false;
        if (endDate) {
          const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);
          if (d > end) return false;
        }
        return true;
      };

      const filteredEntries = entries.filter(e => dateInRange(e.posted_at));

      // Flatten every ledger line that touches one of these accounts
      const ledgerRows: Record<string, any>[] = [];
      filteredEntries.forEach(entry => {
        (entry.entries || []).forEach((line: any) => {
          if (!allCodes.includes(line.account_code)) return;
          ledgerRows.push({
            Date: isoDate(entry.posted_at),
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
      const summaryRows = allCodes.map(code => {
        const lines = ledgerRows.filter(r => r['Account Code'] === code && r.Status === 'posted');
        const debit = lines.reduce((s, r) => s + r.Debit, 0);
        const credit = lines.reduce((s, r) => s + r.Credit, 0);
        const dates = lines.map(r => r.Date).filter(Boolean).sort();
        return {
          'Account Code': code,
          'Account Name': accountName(code),
          'Account Type': accountType(code),
          'In Chart of Accounts': accounts.some(a => a.account_number === code) ? 'Yes' : 'No',
          Transactions: lines.length,
          'First Activity': dates[0] || '',
          'Last Activity': dates[dates.length - 1] || '',
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

      add('Summary', summaryRows, [22, 30, 16, 18, 14, 14, 14, 14, 14, 14]);
      add('Ledger Lines', ledgerRows, [12, 22, 28, 14, 14, 24, 10, 40, 10, 14, 14, 16, 16, 30]);
      add('Mappings', roleRows, [18, 26, 8, 24, 24, 28, 14, 16]);

      const productName = (id: string) => products.find(p => p.id === id)?.name || '';
      const productSku = (id: string) => products.find(p => p.id === id)?.sku || '';
      const productRows = productMappings.map(m => ({
        Product: productName(m.product_id),
        SKU: productSku(m.product_id),
        'Payment Term': m.payment_term || 'Default',
        'Revenue Account Code': m.revenue_account_code || '',
        'Revenue Account Name': accountName(m.revenue_account_code || ''),
        'COGS Account Code': m.cogs_account_code || '',
        'COGS Account Name': accountName(m.cogs_account_code || ''),
        'Inventory Account Code': m.inventory_account_code || '',
        'Inventory Account Name': accountName(m.inventory_account_code || ''),
        'Product ID': m.product_id,
      })).sort((a, b) => a.Product.localeCompare(b.Product));
      add('Product Accounts', productRows, [30, 16, 16, 22, 30, 22, 30, 22, 30, 38]);



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
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">From</span>
            <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" />
            <span className="text-sm text-muted-foreground">To</span>
            <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" />
          </div>
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

      <ProductAccountMappingsSection accounts={accounts} accountsLoading={accountsLoading} />
    </div>

  );
}
