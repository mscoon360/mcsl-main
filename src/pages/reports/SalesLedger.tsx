import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Printer, Search } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { DatePreset, DateRange, exportSheet, fmtDate, fmtMoney, inRange, presetRange } from './reportUtils';

interface SalesLedgerRow {
  id: string;
  date: string;
  customer: string;
  rep: string;
  revenueExVat: number;
  vat: number;
  revenueIncVat: number;
  cos: number;
}

export default function SalesLedger() {
  const [rows, setRows] = useState<SalesLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<DatePreset>('this-year');
  const [range, setRange] = useState<DateRange>(presetRange('this-year'));
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: sales }, { data: items }, { data: profiles }] = await Promise.all([
          supabase.from('sales').select('id, customer_name, date, total, vat_amount, status, user_id').order('date', { ascending: false }),
          supabase.from('sale_items').select('sale_id, quantity, unit_cost'),
          supabase.from('profiles').select('id, name, username'),
        ]);

        const repMap = new Map<string, string>();
        (profiles || []).forEach((p: any) => repMap.set(p.id, p.name || p.username || '—'));

        const cosMap = new Map<string, number>();
        (items || []).forEach((it: any) => {
          const cost = (Number(it.unit_cost) || 0) * (Number(it.quantity) || 0);
          cosMap.set(it.sale_id, (cosMap.get(it.sale_id) || 0) + cost);
        });

        setRows(
          (sales || [])
            .filter((s: any) => s.status === 'completed')
            .map((s: any) => {
              const vat = Number(s.vat_amount) || 0;
              const total = Number(s.total) || 0;
              return {
                id: s.id,
                date: s.date,
                customer: s.customer_name,
                rep: repMap.get(s.user_id) || '—',
                revenueExVat: total - vat,
                vat,
                revenueIncVat: total,
                cos: cosMap.get(s.id) || 0,
              };
            })
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(
    () =>
      rows
        .filter(r => inRange(r.date, range))
        .filter(r => {
          if (!search) return true;
          const q = search.toLowerCase();
          return r.customer.toLowerCase().includes(q) || r.rep.toLowerCase().includes(q);
        }),
    [rows, range, search]
  );

  const totals = filtered.reduce(
    (a, r) => ({
      ex: a.ex + r.revenueExVat,
      vat: a.vat + r.vat,
      inc: a.inc + r.revenueIncVat,
      cos: a.cos + r.cos,
    }),
    { ex: 0, vat: 0, inc: 0, cos: 0 }
  );
  const grossProfit = totals.ex - totals.cos;

  const handleExport = () => {
    exportSheet(
      'Sales_Ledger',
      'Sales Ledger',
      filtered.map(r => ({
        Date: fmtDate(r.date),
        Customer: r.customer,
        Rep: r.rep,
        'Revenue (Excl. VAT)': r.revenueExVat,
        VAT: r.vat,
        'Revenue (Incl. VAT)': r.revenueIncVat,
        'Cost of Sales': r.cos,
        'Gross Profit': r.revenueExVat - r.cos,
      })),
      [12, 28, 22, 20, 14, 20, 16, 16]
    );
  };

  const handlePrint = () => {
    const body = filtered
      .map(
        r => `<tr>
          <td>${fmtDate(r.date)}</td>
          <td>${r.customer}</td>
          <td>${r.rep}</td>
          <td class="n">${fmtMoney(r.revenueExVat)}</td>
          <td class="n">${fmtMoney(r.vat)}</td>
          <td class="n">${fmtMoney(r.revenueIncVat)}</td>
          <td class="n">${fmtMoney(r.cos)}</td>
        </tr>`
      )
      .join('');

    const html = `<!doctype html><html><head><title>Sales Ledger</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111}
        h1{font-size:18px;margin:0 0 4px}
        .sub{font-size:12px;color:#555;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#f3f4f6}
        td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
        tfoot td{font-weight:bold;border-top:2px solid #333}
      </style></head><body>
      <h1>Sales Ledger</h1>
      <div class="sub">${range.from ? fmtDate(range.from.toISOString()) : 'Beginning'} — ${range.to ? fmtDate(range.to.toISOString()) : 'Today'} &middot; ${filtered.length} sales</div>
      <table>
        <thead><tr>
          <th>Date</th><th>Customer</th><th>Rep</th>
          <th class="n">Revenue (Excl. VAT)</th><th class="n">VAT</th>
          <th class="n">Revenue (Incl. VAT)</th><th class="n">Cost of Sales</th>
        </tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr>
          <td colspan="3">TOTAL</td>
          <td class="n">${fmtMoney(totals.ex)}</td>
          <td class="n">${fmtMoney(totals.vat)}</td>
          <td class="n">${fmtMoney(totals.inc)}</td>
          <td class="n">${fmtMoney(totals.cos)}</td>
        </tr></tfoot>
      </table>
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Sales Ledger</CardTitle>
            <p className="text-sm text-muted-foreground">Revenue excl./incl. VAT, customer, rep, date and cost of sales</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <DateRangePicker preset={preset} range={range} onChange={(p, r) => { setPreset(p); setRange(r); }} />
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search customer or rep…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Revenue (Excl. VAT)</div><div className="text-xl font-bold font-mono">{fmtMoney(totals.ex)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">VAT</div><div className="text-xl font-bold font-mono">{fmtMoney(totals.vat)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Revenue (Incl. VAT)</div><div className="text-xl font-bold font-mono">{fmtMoney(totals.inc)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Cost of Sales</div><div className="text-xl font-bold font-mono">{fmtMoney(totals.cos)}</div><div className="text-xs text-muted-foreground mt-1">Gross profit {fmtMoney(grossProfit)}</div></CardContent></Card>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading sales…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="w-[160px]">Rep</TableHead>
                  <TableHead className="text-right w-[140px]">Revenue (Excl. VAT)</TableHead>
                  <TableHead className="text-right w-[110px]">VAT</TableHead>
                  <TableHead className="text-right w-[140px]">Revenue (Incl. VAT)</TableHead>
                  <TableHead className="text-right w-[130px]">Cost of Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{fmtDate(r.date)}</TableCell>
                    <TableCell className="text-sm">{r.customer}</TableCell>
                    <TableCell className="text-sm">{r.rep}</TableCell>
                    <TableCell className="text-right font-mono">{fmtMoney(r.revenueExVat)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtMoney(r.vat)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtMoney(r.revenueIncVat)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtMoney(r.cos)}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No sales in range</TableCell></TableRow>
                )}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={3}>TOTAL ({filtered.length} sales)</TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(totals.ex)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(totals.vat)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(totals.inc)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(totals.cos)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
