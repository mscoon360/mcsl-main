import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLedgerEntries } from '@/hooks/useLedgerEntries';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function TrialBalance() {
  const { trialBalance, isBalanced, entries, loading, unbalancedEntries, refetch } = useLedgerEntries();
  const { toast } = useToast();
  const [backfilling, setBackfilling] = useState(false);

  const totalDebits = trialBalance.reduce((sum, acc) => sum + acc.total_debit, 0);
  const totalCredits = trialBalance.reduce((sum, acc) => sum + acc.total_credit, 0);

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
      console.error('Backfill error:', error);
      toast({
        title: 'Backfill error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setBackfilling(false);
    }
  };

  const exportToExcel = () => {
    const headers = ['Account Code', 'Total Debit', 'Total Credit', 'Balance'];
    const rows = trialBalance.map(acc => [
      acc.account_code,
      acc.total_debit.toFixed(2),
      acc.total_credit.toFixed(2),
      acc.balance.toFixed(2)
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
      '',
      `Total Debits,${totalDebits.toFixed(2)}`,
      `Total Credits,${totalCredits.toFixed(2)}`,
      `Difference,${Math.abs(totalDebits - totalCredits).toFixed(2)}`
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trial-balance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Trial Balance Validator</h1>
          <p className="text-muted-foreground">Double-entry ledger validation and reporting</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleBackfill(true)}
            disabled={backfilling}
          >
            {backfilling ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
            Test Backfill (50)
          </Button>
          <Button
            onClick={() => handleBackfill(false)}
            disabled={backfilling}
          >
            {backfilling ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
            Run Backfill
          </Button>
          <Button variant="outline" onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Alert className={isBalanced ? '' : 'border-destructive bg-destructive/10'}>
        {isBalanced ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
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
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entries.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Debits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalDebits.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCredits.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Difference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isBalanced ? 'text-green-600' : 'text-destructive'}`}>
              ${Math.abs(totalDebits - totalCredits).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trial Balance</CardTitle>
          <CardDescription>Account balances across all posted ledger entries</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading trial balance...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Code</TableHead>
                  <TableHead className="text-right">Total Debits</TableHead>
                  <TableHead className="text-right">Total Credits</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trialBalance.map((account) => (
                  <TableRow key={account.account_code}>
                    <TableCell className="font-medium">{account.account_code}</TableCell>
                    <TableCell className="text-right">
                      ${account.total_debit.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${account.total_credit.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={account.balance > 0 ? 'text-green-600' : account.balance < 0 ? 'text-red-600' : ''}>
                        ${account.balance.toFixed(2)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">${totalDebits.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${totalCredits.toFixed(2)}</TableCell>
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
                    <TableCell>
                      <Badge variant="outline">{entry.source_type}</Badge>
                    </TableCell>
                    <TableCell>{new Date(entry.posted_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">${entry.total_debit.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${entry.total_credit.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-destructive font-bold">
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
