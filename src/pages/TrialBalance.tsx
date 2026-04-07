import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLedgerEntries } from '@/hooks/useLedgerEntries';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Download, RefreshCw, CalendarIcon, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

export default function TrialBalance() {
  const { trialBalance, isBalanced, entries, loading, unbalancedEntries, refetch } = useLedgerEntries();
  const { accounts } = useChartOfAccounts();
  const { toast } = useToast();
  const [backfilling, setBackfilling] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Map account codes to COA names
  const accountMap = useMemo(() => {
    const map: Record<string, { name: string; number: string; type: string }> = {};
    accounts.forEach(a => {
      map[a.account_number] = { name: a.account_name, number: a.account_number, type: a.account_type };
    });
    return map;
  }, [accounts]);

  // Enrich trial balance with COA data
  const enrichedTrialBalance = useMemo(() => {
    return trialBalance.map(entry => {
      const coaMatch = accountMap[entry.account_code] || 
        Object.values(accountMap).find(a => 
          a.number.replace(/\s/g, '') === entry.account_code.replace(/\s/g, '')
        );
      return {
        ...entry,
        account_name: coaMatch?.name || entry.account_code,
        account_number: coaMatch?.number || entry.account_code,
        account_type: coaMatch?.type || 'unknown',
      };
    });
  }, [trialBalance, accountMap]);

  // Filter
  const filteredBalance = useMemo(() => {
    return enrichedTrialBalance.filter(entry => {
      const matchesSearch = searchTerm === '' ||
        entry.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.account_code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || entry.account_type === filterType;
      return matchesSearch && matchesType;
    });
  }, [enrichedTrialBalance, searchTerm, filterType]);

  const totalDebits = filteredBalance.reduce((sum, acc) => sum + acc.total_debit, 0);
  const totalCredits = filteredBalance.reduce((sum, acc) => sum + acc.total_credit, 0);

  const handleBackfill = async (testMode: boolean = false) => {
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-ledger', {
        body: { 
          batch_size: testMode ? 50 : 100,
          test_mode: testMode,
          source_types: ['sale', 'payment', 'expense']
        }
      });
      if (error) throw error;
      toast({
        title: testMode ? 'Test backfill complete' : 'Backfill complete',
        description: `Processed: ${data.processed}, Success: ${data.success}, Errors: ${data.error}, Skipped: ${data.skipped}`
      });
      await refetch();
    } catch (error: any) {
      toast({ title: 'Backfill error', description: error.message, variant: 'destructive' });
    } finally {
      setBackfilling(false);
    }
  };

  const exportToExcel = () => {
    const exportData = filteredBalance.map(acc => ({
      'Account Code': acc.account_code,
      'Account Name': acc.account_name,
      'Type': acc.account_type.charAt(0).toUpperCase() + acc.account_type.slice(1),
      'Total Debits': Number(acc.total_debit.toFixed(2)),
      'Total Credits': Number(acc.total_credit.toFixed(2)),
      'Balance': Number(acc.balance.toFixed(2)),
    }));

    // Add totals row
    exportData.push({
      'Account Code': '',
      'Account Name': 'TOTAL',
      'Type': '',
      'Total Debits': Number(totalDebits.toFixed(2)),
      'Total Credits': Number(totalCredits.toFixed(2)),
      'Balance': Number((totalDebits - totalCredits).toFixed(2)),
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { width: 20 }, { width: 40 }, { width: 12 },
      { width: 15 }, { width: 15 }, { width: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance');
    XLSX.writeFile(wb, `Trial_Balance_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: 'Export Complete', description: 'Trial balance exported to Excel.' });
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      asset: 'text-green-600',
      liability: 'text-red-500',
      equity: 'text-blue-500',
      revenue: 'text-emerald-500',
      expense: 'text-orange-500',
    };
    return colors[type] || '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Trial Balance</h1>
          <p className="text-muted-foreground">Double-entry ledger validation and reporting</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => handleBackfill(true)} disabled={backfilling} size="sm">
            {backfilling && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
            Test Backfill
          </Button>
          <Button onClick={() => handleBackfill(false)} disabled={backfilling} size="sm">
            {backfilling && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
            Run Backfill
          </Button>
          <Button variant="outline" onClick={exportToExcel} size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      <Alert className={isBalanced ? '' : 'border-destructive bg-destructive/10'}>
        {isBalanced ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
        <AlertTitle className={isBalanced ? '' : 'text-destructive'}>
          {isBalanced ? 'Ledger is Balanced' : 'Ledger Out of Balance'}
        </AlertTitle>
        <AlertDescription>
          {isBalanced
            ? 'Total debits equal total credits. All journal entries are properly balanced.'
            : `Difference: $${Math.abs(totalDebits - totalCredits).toFixed(2)}. Please review unbalanced entries below.`}
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Debits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalDebits.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCredits.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Difference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isBalanced ? 'text-green-600' : 'text-destructive'}`}>
              ${Math.abs(totalDebits - totalCredits).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by account code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="asset">Assets</SelectItem>
            <SelectItem value="liability">Liabilities</SelectItem>
            <SelectItem value="equity">Equity</SelectItem>
            <SelectItem value="revenue">Revenue</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trial Balance</CardTitle>
          <CardDescription>
            Account balances across all posted ledger entries
            {filteredBalance.length !== enrichedTrialBalance.length && 
              ` (showing ${filteredBalance.length} of ${enrichedTrialBalance.length})`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading trial balance...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total Debits</TableHead>
                  <TableHead className="text-right">Total Credits</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBalance.map((account) => (
                  <TableRow key={account.account_code}>
                    <TableCell className="font-mono text-sm">{account.account_code}</TableCell>
                    <TableCell className="font-medium">{account.account_name}</TableCell>
                    <TableCell>
                      <span className={cn('text-sm capitalize', getTypeColor(account.account_type))}>
                        {account.account_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">${account.total_debit.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">${account.total_credit.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={account.balance > 0 ? 'text-green-600' : account.balance < 0 ? 'text-red-600' : ''}>
                        ${account.balance.toFixed(2)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredBalance.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No entries found
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={3}>TOTAL</TableCell>
                  <TableCell className="text-right font-mono">${totalDebits.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">${totalCredits.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={isBalanced ? 'default' : 'destructive'}>
                      ${Math.abs(totalDebits - totalCredits).toFixed(2)}
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {unbalancedEntries.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Unbalanced Entries</CardTitle>
            <CardDescription>
              These entries have mismatched debits and credits and require attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Source Type</TableHead>
                  <TableHead>Posted At</TableHead>
                  <TableHead className="text-right">Total Debit</TableHead>
                  <TableHead className="text-right">Total Credit</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unbalancedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-sm">{entry.transaction_id}</TableCell>
                    <TableCell><Badge variant="outline">{entry.source_type}</Badge></TableCell>
                    <TableCell>{new Date(entry.posted_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-mono">${entry.total_debit.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">${entry.total_credit.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-destructive font-bold font-mono">
                      ${Math.abs(entry.total_debit - entry.total_credit).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
