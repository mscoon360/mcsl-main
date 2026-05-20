import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';
import { useLedgerEntries } from '@/hooks/useLedgerEntries';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { DateRangePicker } from './DateRangePicker';
import { DatePreset, DateRange, debitNatured, exportSheet, fmtDate, fmtMoney, inRange, presetRange } from './reportUtils';

export default function AccountLedger() {
  const { entries, loading } = useLedgerEntries();
  const { accounts } = useChartOfAccounts();
  const [selected, setSelected] = useState<string>('');
  const [preset, setPreset] = useState<DatePreset>('this-year');
  const [range, setRange] = useState<DateRange>(presetRange('this-year'));

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.account_number.localeCompare(b.account_number)),
    [accounts]
  );

  const account = accounts.find(a => a.account_number === selected);

  const rows = useMemo(() => {
    if (!selected) return [];
    const isDebit = debitNatured(account?.account_type ?? 'asset');

    const inScope = entries
      .filter(e => e.status === 'posted')
      .filter(e => inRange(e.posted_at, range))
      .flatMap(e => e.entries
        .filter(line => line.account_code === selected)
        .map(line => ({
          posted_at: e.posted_at,
          transaction_id: e.transaction_id,
          source_type: e.source_type,
          memo: line.memo,
          debit: line.debit || 0,
          credit: line.credit || 0,
        }))
      )
      .sort((a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime());

    let running = 0;
    return inScope.map(r => {
      running += isDebit ? r.debit - r.credit : r.credit - r.debit;
      return { ...r, balance: running };
    });
  }, [entries, selected, range, account]);

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const closing = rows.length ? rows[rows.length - 1].balance : 0;

  const handleExport = () => {
    if (!account) return;
    exportSheet(
      `Account_Ledger_${account.account_number}`,
      account.account_number,
      rows.map(r => ({
        Date: fmtDate(r.posted_at),
        'Transaction ID': r.transaction_id,
        Source: r.source_type,
        Memo: r.memo,
        Debit: r.debit,
        Credit: r.credit,
        Balance: r.balance,
      })),
      [12, 24, 14, 40, 14, 14, 16]
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Account Ledger</CardTitle>
            <p className="text-sm text-muted-foreground">Every journal line for a single account with running balance</p>
          </div>
          <Button variant="outline" onClick={handleExport} size="sm" disabled={!account}>
            <Download className="h-4 w-4 mr-2" />Export Excel
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-[340px]">
                <SelectValue placeholder="Select account…" />
              </SelectTrigger>
              <SelectContent>
                {sortedAccounts.map(a => (
                  <SelectItem key={a.id} value={a.account_number}>
                    {a.account_number} — {a.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangePicker preset={preset} range={range} onChange={(p, r) => { setPreset(p); setRange(r); }} />
          </div>

          {!selected ? (
            <div className="text-center py-12 text-muted-foreground">Select an account to view its ledger</div>
          ) : loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading…</div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Debits</div><div className="text-xl font-bold font-mono">{fmtMoney(totalDebit)}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Credits</div><div className="text-xl font-bold font-mono">{fmtMoney(totalCredit)}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Closing Balance</div><div className="text-xl font-bold font-mono">{fmtMoney(closing)}</div></CardContent></Card>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Date</TableHead>
                    <TableHead className="w-[100px]">Source</TableHead>
                    <TableHead>Memo</TableHead>
                    <TableHead className="text-right w-[120px]">Debit</TableHead>
                    <TableHead className="text-right w-[120px]">Credit</TableHead>
                    <TableHead className="text-right w-[140px]">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{fmtDate(r.posted_at)}</TableCell>
                      <TableCell className="text-xs">{r.source_type}</TableCell>
                      <TableCell className="text-sm">{r.memo}</TableCell>
                      <TableCell className="text-right font-mono">{r.debit ? fmtMoney(r.debit) : ''}</TableCell>
                      <TableCell className="text-right font-mono">{r.credit ? fmtMoney(r.credit) : ''}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{fmtMoney(r.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No activity for this account in range</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
