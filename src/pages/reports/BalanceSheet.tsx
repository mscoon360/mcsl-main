import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Download } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useLedgerEntries } from '@/hooks/useLedgerEntries';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { exportSheet, fmtMoney } from './reportUtils';

interface AccountLine { code: string; name: string; subtype: string; amount: number; }

const subtypeLabel: Record<string, string> = {
  'current-asset': 'Current Assets',
  'fixed-asset': 'Fixed Assets',
  'other-asset': 'Other Assets',
  'current-liability': 'Current Liabilities',
  'long-term-liability': 'Long-term Liabilities',
  'equity': 'Equity',
  'operating-revenue': 'Operating Revenue',
  'other-revenue': 'Other Revenue',
};

export default function BalanceSheet() {
  const { entries, loading } = useLedgerEntries();
  const { accounts } = useChartOfAccounts();
  const [asOf, setAsOf] = useState<Date>(new Date());

  const data = useMemo(() => {
    const meta: Record<string, { name: string; type: string; subtype: string }> = {};
    accounts.forEach(a => { meta[a.account_number] = { name: a.account_name, type: a.account_type, subtype: a.account_subtype }; });

    const endOfDay = new Date(asOf); endOfDay.setHours(23, 59, 59, 999);
    const totals: Record<string, { debit: number; credit: number }> = {};
    entries
      .filter(e => e.status === 'posted')
      .filter(e => new Date(e.posted_at) <= endOfDay)
      .forEach(e => e.entries.forEach(line => {
        const t = totals[line.account_code] ?? { debit: 0, credit: 0 };
        t.debit += line.debit || 0;
        t.credit += line.credit || 0;
        totals[line.account_code] = t;
      }));

    const groups: Record<string, AccountLine[]> = {};
    let totalRevenue = 0, totalExpense = 0;

    Object.entries(totals).forEach(([code, t]) => {
      const m = meta[code];
      if (!m) return;
      if (m.type === 'asset') {
        const amount = t.debit - t.credit;
        if (amount === 0) return;
        (groups[m.subtype] ??= []).push({ code, name: m.name, subtype: m.subtype, amount });
      } else if (m.type === 'liability' || m.type === 'equity') {
        const amount = t.credit - t.debit;
        if (amount === 0) return;
        (groups[m.subtype] ??= []).push({ code, name: m.name, subtype: m.subtype, amount });
      } else if (m.type === 'revenue') {
        totalRevenue += t.credit - t.debit;
      } else if (m.type === 'expense') {
        totalExpense += t.debit - t.credit;
      }
    });

    const retainedEarnings = totalRevenue - totalExpense;
    if (retainedEarnings !== 0) {
      (groups['equity'] ??= []).push({
        code: '—', name: 'Current Period Earnings (computed)', subtype: 'equity', amount: retainedEarnings,
      });
    }

    const sumGroup = (key: string) => (groups[key] ?? []).reduce((s, l) => s + l.amount, 0);

    const totalCurrentAssets = sumGroup('current-asset');
    const totalFixedAssets = sumGroup('fixed-asset');
    const totalOtherAssets = sumGroup('other-asset');
    const totalAssets = totalCurrentAssets + totalFixedAssets + totalOtherAssets;
    const totalCurrentLiab = sumGroup('current-liability');
    const totalLongLiab = sumGroup('long-term-liability');
    const totalLiabilities = totalCurrentLiab + totalLongLiab;
    const totalEquity = sumGroup('equity');
    const totalLiabEquity = totalLiabilities + totalEquity;

    return {
      groups,
      totalCurrentAssets, totalFixedAssets, totalOtherAssets, totalAssets,
      totalCurrentLiab, totalLongLiab, totalLiabilities,
      totalEquity, totalLiabEquity,
      balanced: Math.abs(totalAssets - totalLiabEquity) < 0.01,
    };
  }, [entries, accounts, asOf]);

  const Section = ({ subtype, total }: { subtype: string; total: number }) => {
    const lines = data.groups[subtype] ?? [];
    if (lines.length === 0 && total === 0) return null;
    return (
      <>
        <TableRow><TableCell colSpan={3} className="font-bold pt-3">{subtypeLabel[subtype] ?? subtype}</TableCell></TableRow>
        {lines.map(l => (
          <TableRow key={l.code + l.name}>
            <TableCell className="pl-8 font-mono text-xs text-muted-foreground">{l.code}</TableCell>
            <TableCell>{l.name}</TableCell>
            <TableCell className="text-right font-mono">{fmtMoney(l.amount)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="border-t">
          <TableCell colSpan={2} className="pl-4 font-semibold">Total {subtypeLabel[subtype] ?? subtype}</TableCell>
          <TableCell className="text-right font-mono font-semibold">{fmtMoney(total)}</TableCell>
        </TableRow>
      </>
    );
  };

  const handleExport = () => {
    const rows: any[] = [];
    const push = (label: string, code: string, amount: number | string) =>
      rows.push({ Section: label, Code: code, Amount: amount });
    push(`BALANCE SHEET as of ${format(asOf, 'PP')}`, '', '');
    push('ASSETS', '', '');
    (['current-asset','fixed-asset','other-asset'] as const).forEach(st => {
      (data.groups[st] ?? []).forEach(l => push(`  ${l.name}`, l.code, l.amount));
    });
    push('TOTAL ASSETS', '', data.totalAssets);
    push('LIABILITIES', '', '');
    (['current-liability','long-term-liability'] as const).forEach(st => {
      (data.groups[st] ?? []).forEach(l => push(`  ${l.name}`, l.code, l.amount));
    });
    push('TOTAL LIABILITIES', '', data.totalLiabilities);
    push('EQUITY', '', '');
    (data.groups['equity'] ?? []).forEach(l => push(`  ${l.name}`, l.code, l.amount));
    push('TOTAL EQUITY', '', data.totalEquity);
    push('TOTAL LIABILITIES + EQUITY', '', data.totalLiabEquity);
    exportSheet('Balance_Sheet', 'Balance Sheet', rows, [40, 14, 18]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Balance Sheet</CardTitle>
            <p className="text-sm text-muted-foreground">Statement of Financial Position as of a given date</p>
          </div>
          <Button variant="outline" onClick={handleExport} size="sm">
            <Download className="h-4 w-4 mr-2" />Export Excel
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-[220px] justify-start text-left font-normal')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                As of {format(asOf, 'PP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={asOf} onSelect={(d) => d && setAsOf(d)} />
            </PopoverContent>
          </Popover>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading…</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Code</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right w-[180px]">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/40"><TableCell colSpan={3} className="font-bold">ASSETS</TableCell></TableRow>
                  <Section subtype="current-asset" total={data.totalCurrentAssets} />
                  <Section subtype="fixed-asset" total={data.totalFixedAssets} />
                  <Section subtype="other-asset" total={data.totalOtherAssets} />
                  <TableRow className="border-t-2 bg-primary/5">
                    <TableCell colSpan={2} className="font-bold">TOTAL ASSETS</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmtMoney(data.totalAssets)}</TableCell>
                  </TableRow>

                  <TableRow className="bg-muted/40"><TableCell colSpan={3} className="font-bold pt-4">LIABILITIES</TableCell></TableRow>
                  <Section subtype="current-liability" total={data.totalCurrentLiab} />
                  <Section subtype="long-term-liability" total={data.totalLongLiab} />
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">Total Liabilities</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmtMoney(data.totalLiabilities)}</TableCell>
                  </TableRow>

                  <TableRow className="bg-muted/40"><TableCell colSpan={3} className="font-bold pt-4">EQUITY</TableCell></TableRow>
                  <Section subtype="equity" total={data.totalEquity} />

                  <TableRow className="border-t-2 bg-primary/5">
                    <TableCell colSpan={2} className="font-bold">TOTAL LIABILITIES + EQUITY</TableCell>
                    <TableCell className="text-right font-mono font-bold">{fmtMoney(data.totalLiabEquity)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <div className={`text-sm font-medium ${data.balanced ? 'text-green-600' : 'text-destructive'}`}>
                {data.balanced
                  ? 'Balance sheet balances (Assets = Liabilities + Equity).'
                  : `Out of balance by ${fmtMoney(Math.abs(data.totalAssets - data.totalLiabEquity))}.`}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
