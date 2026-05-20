import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Search } from 'lucide-react';
import { useLedgerEntries } from '@/hooks/useLedgerEntries';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { DateRangePicker } from './DateRangePicker';
import { DatePreset, DateRange, exportSheet, fmtDate, fmtMoney, inRange, presetRange } from './reportUtils';

interface LedgerLine {
  posted_at: string;
  transaction_id: string;
  source_type: string;
  account_code: string;
  account_name: string;
  account_type: string;
  memo: string;
  debit: number;
  credit: number;
}

export default function GeneralLedger() {
  const { entries, loading } = useLedgerEntries();
  const { accounts } = useChartOfAccounts();
  const [preset, setPreset] = useState<DatePreset>('this-year');
  const [range, setRange] = useState<DateRange>(presetRange('this-year'));
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const accountMap = useMemo(() => {
    const m: Record<string, { name: string; type: string }> = {};
    accounts.forEach(a => { m[a.account_number] = { name: a.account_name, type: a.account_type }; });
    return m;
  }, [accounts]);

  const lines: LedgerLine[] = useMemo(() => {
    const out: LedgerLine[] = [];
    entries
      .filter(e => e.status === 'posted')
      .filter(e => inRange(e.posted_at, range))
      .filter(e => sourceFilter === 'all' || e.source_type === sourceFilter)
      .forEach(e => {
        e.entries.forEach(line => {
          const meta = accountMap[line.account_code];
          out.push({
            posted_at: e.posted_at,
            transaction_id: e.transaction_id,
            source_type: e.source_type,
            account_code: line.account_code,
            account_name: meta?.name ?? line.account_code,
            account_type: meta?.type ?? 'unknown',
            memo: line.memo,
            debit: line.debit || 0,
            credit: line.credit || 0,
          });
        });
      });
    return out
      .filter(l => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          l.account_code.toLowerCase().includes(q) ||
          l.account_name.toLowerCase().includes(q) ||
          l.memo.toLowerCase().includes(q) ||
          l.transaction_id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());
  }, [entries, range, sourceFilter, search, accountMap]);

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  const handleExport = () => {
    exportSheet(
      'General_Ledger',
      'General Ledger',
      lines.map(l => ({
        Date: fmtDate(l.posted_at),
        'Transaction ID': l.transaction_id,
        Source: l.source_type,
        'Account Code': l.account_code,
        'Account Name': l.account_name,
        Memo: l.memo,
        Debit: l.debit,
        Credit: l.credit,
      })),
      [12, 22, 12, 22, 32, 40, 14, 14]
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>General Ledger</CardTitle>
            <p className="text-sm text-muted-foreground">All posted journal lines across every account</p>
          </div>
          <Button variant="outline" onClick={handleExport} size="sm">
            <Download className="h-4 w-4 mr-2" />Export Excel
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <DateRangePicker preset={preset} range={range} onChange={(p, r) => { setPreset(p); setRange(r); }} />
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
                <SelectItem value="invoice_adjustment">Invoice Adjustment</SelectItem>
                <SelectItem value="accounts_payable">Accounts Payable</SelectItem>
                <SelectItem value="accounts_receivable">Accounts Receivable</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search account, memo, transaction…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading ledger…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Date</TableHead>
                  <TableHead className="w-[100px]">Source</TableHead>
                  <TableHead className="w-[140px]">Account</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead className="text-right w-[120px]">Debit</TableHead>
                  <TableHead className="text-right w-[120px]">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{fmtDate(l.posted_at)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{l.source_type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">
                      <div>{l.account_code}</div>
                      <div className="text-muted-foreground">{l.account_name}</div>
                    </TableCell>
                    <TableCell className="text-sm">{l.memo}</TableCell>
                    <TableCell className="text-right font-mono">{l.debit ? fmtMoney(l.debit) : ''}</TableCell>
                    <TableCell className="text-right font-mono">{l.credit ? fmtMoney(l.credit) : ''}</TableCell>
                  </TableRow>
                ))}
                {lines.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No entries in range</TableCell></TableRow>
                )}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={4}>TOTAL ({lines.length} lines)</TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(totalDebit)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(totalCredit)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
