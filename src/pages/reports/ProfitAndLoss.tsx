import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useLedgerEntries } from '@/hooks/useLedgerEntries';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { DateRangePicker } from './DateRangePicker';
import { DatePreset, DateRange, exportSheet, fmtMoney, inRange, presetRange } from './reportUtils';

interface AccountLine { code: string; name: string; subtype: string; amount: number; }

export default function ProfitAndLoss() {
  const { entries, loading } = useLedgerEntries();
  const { accounts } = useChartOfAccounts();
  const [preset, setPreset] = useState<DatePreset>('this-year');
  const [range, setRange] = useState<DateRange>(presetRange('this-year'));

  const data = useMemo(() => {
    const meta: Record<string, { name: string; type: string; subtype: string }> = {};
    accounts.forEach(a => { meta[a.account_number] = { name: a.account_name, type: a.account_type, subtype: a.account_subtype }; });

    const totals: Record<string, { debit: number; credit: number }> = {};
    entries
      .filter(e => e.status === 'posted')
      .filter(e => inRange(e.posted_at, range))
      .forEach(e => e.entries.forEach(line => {
        const t = totals[line.account_code] ?? { debit: 0, credit: 0 };
        t.debit += line.debit || 0;
        t.credit += line.credit || 0;
        totals[line.account_code] = t;
      }));

    const revenue: AccountLine[] = [];
    const cogs: AccountLine[] = [];
    const opex: AccountLine[] = [];
    const otherExpense: AccountLine[] = [];
    const otherRevenue: AccountLine[] = [];

    Object.entries(totals).forEach(([code, t]) => {
      const m = meta[code];
      if (!m) return;
      const debitTotal = t.debit, creditTotal = t.credit;
      if (m.type === 'revenue') {
        const amount = creditTotal - debitTotal;
        if (amount === 0) return;
        const line: AccountLine = { code, name: m.name, subtype: m.subtype, amount };
        if (m.subtype === 'other-revenue') otherRevenue.push(line); else revenue.push(line);
      } else if (m.type === 'expense') {
        const amount = debitTotal - creditTotal;
        if (amount === 0) return;
        const line: AccountLine = { code, name: m.name, subtype: m.subtype, amount };
        if (m.subtype === 'cost-of-goods-sold') cogs.push(line);
        else if (m.subtype === 'other-expense') otherExpense.push(line);
        else opex.push(line);
      }
    });

    const sum = (arr: AccountLine[]) => arr.reduce((s, l) => s + l.amount, 0);
    const totalRevenue = sum(revenue);
    const totalCogs = sum(cogs);
    const grossProfit = totalRevenue - totalCogs;
    const totalOpex = sum(opex);
    const operatingProfit = grossProfit - totalOpex;
    const totalOtherRevenue = sum(otherRevenue);
    const totalOtherExpense = sum(otherExpense);
    const netProfit = operatingProfit + totalOtherRevenue - totalOtherExpense;

    return { revenue, cogs, opex, otherRevenue, otherExpense, totalRevenue, totalCogs, grossProfit, totalOpex, operatingProfit, totalOtherRevenue, totalOtherExpense, netProfit };
  }, [entries, accounts, range]);

  const Section = ({ title, lines, total }: { title: string; lines: AccountLine[]; total: number }) =>
    lines.length === 0 ? null : (
      <>
        <TableRow><TableCell colSpan={3} className="font-bold pt-4">{title}</TableCell></TableRow>
        {lines.map(l => (
          <TableRow key={l.code}>
            <TableCell className="pl-8 font-mono text-xs text-muted-foreground">{l.code}</TableCell>
            <TableCell>{l.name}</TableCell>
            <TableCell className="text-right font-mono">{fmtMoney(l.amount)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="border-t">
          <TableCell colSpan={2} className="font-semibold pl-4">Total {title}</TableCell>
          <TableCell className="text-right font-mono font-semibold">{fmtMoney(total)}</TableCell>
        </TableRow>
      </>
    );

  const handleExport = () => {
    const rows: any[] = [];
    const push = (label: string, code: string, amount: number, indent = false) =>
      rows.push({ Section: indent ? `  ${label}` : label, Code: code, Amount: amount });

    push('REVENUE', '', 0);
    data.revenue.forEach(l => push(l.name, l.code, l.amount, true));
    push('Total Revenue', '', data.totalRevenue);
    push('COST OF GOODS SOLD', '', 0);
    data.cogs.forEach(l => push(l.name, l.code, l.amount, true));
    push('Total COGS', '', data.totalCogs);
    push('GROSS PROFIT', '', data.grossProfit);
    push('OPERATING EXPENSES', '', 0);
    data.opex.forEach(l => push(l.name, l.code, l.amount, true));
    push('Total Operating Expenses', '', data.totalOpex);
    push('OPERATING PROFIT', '', data.operatingProfit);
    if (data.otherRevenue.length) {
      push('OTHER INCOME', '', 0);
      data.otherRevenue.forEach(l => push(l.name, l.code, l.amount, true));
      push('Total Other Income', '', data.totalOtherRevenue);
    }
    if (data.otherExpense.length) {
      push('OTHER EXPENSES', '', 0);
      data.otherExpense.forEach(l => push(l.name, l.code, l.amount, true));
      push('Total Other Expenses', '', data.totalOtherExpense);
    }
    push('NET PROFIT', '', data.netProfit);
    exportSheet('Profit_and_Loss', 'P&L', rows, [40, 14, 18]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Profit & Loss Statement</CardTitle>
            <p className="text-sm text-muted-foreground">Income Statement for the selected period</p>
          </div>
          <Button variant="outline" onClick={handleExport} size="sm">
            <Download className="h-4 w-4 mr-2" />Export Excel
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <DateRangePicker preset={preset} range={range} onChange={(p, r) => { setPreset(p); setRange(r); }} />

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right w-[180px]">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Section title="Revenue" lines={data.revenue} total={data.totalRevenue} />
                <Section title="Cost of Goods Sold" lines={data.cogs} total={data.totalCogs} />
                <TableRow className="bg-muted/40">
                  <TableCell colSpan={2} className="font-bold">GROSS PROFIT</TableCell>
                  <TableCell className="text-right font-mono font-bold">{fmtMoney(data.grossProfit)}</TableCell>
                </TableRow>
                <Section title="Operating Expenses" lines={data.opex} total={data.totalOpex} />
                <TableRow className="bg-muted/40">
                  <TableCell colSpan={2} className="font-bold">OPERATING PROFIT</TableCell>
                  <TableCell className="text-right font-mono font-bold">{fmtMoney(data.operatingProfit)}</TableCell>
                </TableRow>
                <Section title="Other Income" lines={data.otherRevenue} total={data.totalOtherRevenue} />
                <Section title="Other Expenses" lines={data.otherExpense} total={data.totalOtherExpense} />
                <TableRow className="border-t-2 bg-primary/5">
                  <TableCell colSpan={2} className="font-bold text-base">NET PROFIT</TableCell>
                  <TableCell className={`text-right font-mono font-bold text-base ${data.netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {fmtMoney(data.netProfit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
