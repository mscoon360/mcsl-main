import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { CalendarIcon, Download, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useAccountsPayable } from '@/hooks/useAccountsPayable';
import { exportSheet, fmtDate, fmtMoney } from './reportUtils';

const BUCKETS = ['Current', '1-30', '31-60', '61-90', '90+'] as const;
type Bucket = typeof BUCKETS[number];

const bucketOf = (dueDateIso: string, asOf: Date): Bucket => {
  const due = new Date(dueDateIso);
  const days = Math.floor((asOf.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Current';
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
};

export default function APAging() {
  const { bills, loading } = useAccountsPayable();
  const [asOf, setAsOf] = useState<Date>(new Date());
  const [search, setSearch] = useState('');

  const open = useMemo(() =>
    bills
      .map(b => ({ ...b, outstanding: b.amount - (b.amount_paid || 0) }))
      .filter(b => b.outstanding > 0.01)
      .filter(b => !search || b.vendor_name.toLowerCase().includes(search.toLowerCase()) || b.bill_number.toLowerCase().includes(search.toLowerCase()))
      .map(b => ({ ...b, bucket: bucketOf(b.due_date, asOf) })),
    [bills, asOf, search]
  );

  const byVendor = useMemo(() => {
    const m = new Map<string, { vendor_name: string; buckets: Record<Bucket, number>; total: number }>();
    open.forEach(b => {
      const row = m.get(b.vendor_name) ?? { vendor_name: b.vendor_name, buckets: { 'Current': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }, total: 0 };
      row.buckets[b.bucket] += b.outstanding;
      row.total += b.outstanding;
      m.set(b.vendor_name, row);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [open]);

  const totals = useMemo(() => {
    const t: Record<Bucket, number> = { 'Current': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    byVendor.forEach(v => BUCKETS.forEach(b => { t[b] += v.buckets[b]; }));
    return t;
  }, [byVendor]);
  const grandTotal = byVendor.reduce((s, v) => s + v.total, 0);

  const handleExport = () => {
    const rows = byVendor.map(v => ({
      Vendor: v.vendor_name,
      Current: v.buckets.Current,
      '1-30': v.buckets['1-30'],
      '31-60': v.buckets['31-60'],
      '61-90': v.buckets['61-90'],
      '90+': v.buckets['90+'],
      Total: v.total,
    }));
    rows.push({
      Vendor: 'TOTAL',
      Current: totals.Current, '1-30': totals['1-30'], '31-60': totals['31-60'], '61-90': totals['61-90'], '90+': totals['90+'],
      Total: grandTotal,
    });
    exportSheet('AP_Aging', 'AP Aging', rows, [32, 14, 14, 14, 14, 14, 16]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Accounts Payable Aging</CardTitle>
            <p className="text-sm text-muted-foreground">Outstanding supplier bills bucketed by days past due</p>
          </div>
          <Button variant="outline" onClick={handleExport} size="sm">
            <Download className="h-4 w-4 mr-2" />Export Excel
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[220px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  As of {format(asOf, 'PP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={asOf} onSelect={d => d && setAsOf(d)} />
              </PopoverContent>
            </Popover>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search vendor or bill…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading…</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    {BUCKETS.map(b => <TableHead key={b} className="text-right">{b}</TableHead>)}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byVendor.map(v => (
                    <TableRow key={v.vendor_name}>
                      <TableCell className="font-medium">{v.vendor_name}</TableCell>
                      {BUCKETS.map(b => <TableCell key={b} className="text-right font-mono">{v.buckets[b] ? fmtMoney(v.buckets[b]) : ''}</TableCell>)}
                      <TableCell className="text-right font-mono font-semibold">{fmtMoney(v.total)}</TableCell>
                    </TableRow>
                  ))}
                  {byVendor.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No outstanding payables</TableCell></TableRow>
                  )}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>TOTAL</TableCell>
                    {BUCKETS.map(b => <TableCell key={b} className="text-right font-mono">{fmtMoney(totals[b])}</TableCell>)}
                    <TableCell className="text-right font-mono">{fmtMoney(grandTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {open.length > 0 && (
                <details className="border rounded-md p-3">
                  <summary className="cursor-pointer text-sm font-medium">Bill detail ({open.length})</summary>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bill</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Bill Date</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Bucket</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {open.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()).map(b => (
                        <TableRow key={b.id}>
                          <TableCell className="font-mono text-xs">{b.bill_number}</TableCell>
                          <TableCell>{b.vendor_name}</TableCell>
                          <TableCell className="text-sm">{fmtDate(b.bill_date)}</TableCell>
                          <TableCell className="text-sm">{fmtDate(b.due_date)}</TableCell>
                          <TableCell className="text-sm">{b.bucket}</TableCell>
                          <TableCell className="text-right font-mono">{fmtMoney(b.outstanding)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </details>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
