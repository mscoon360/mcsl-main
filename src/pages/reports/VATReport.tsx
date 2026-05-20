import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLedgerEntries } from '@/hooks/useLedgerEntries';
import { DateRangePicker } from './DateRangePicker';
import { DatePreset, DateRange, fmtDate, fmtMoney, inRange, presetRange } from './reportUtils';

const OUTPUT_VAT_CODE = '2300_vat_payable';
const INPUT_VAT_CODE = '1200_vat_receivable';

interface VATLine {
  posted_at: string;
  transaction_id: string;
  source_type: string;
  memo: string;
  amount: number;
}

export default function VATReport() {
  const { entries, loading } = useLedgerEntries();
  const [preset, setPreset] = useState<DatePreset>('this-quarter');
  const [range, setRange] = useState<DateRange>(presetRange('this-quarter'));

  const data = useMemo(() => {
    const output: VATLine[] = [];
    const input: VATLine[] = [];

    entries
      .filter(e => e.status === 'posted')
      .filter(e => inRange(e.posted_at, range))
      .forEach(e => {
        e.entries.forEach(line => {
          if (line.account_code === OUTPUT_VAT_CODE && (line.credit || 0) > 0) {
            output.push({
              posted_at: e.posted_at,
              transaction_id: e.transaction_id,
              source_type: e.source_type,
              memo: line.memo,
              amount: line.credit,
            });
          } else if (line.account_code === INPUT_VAT_CODE && (line.debit || 0) > 0) {
            input.push({
              posted_at: e.posted_at,
              transaction_id: e.transaction_id,
              source_type: e.source_type,
              memo: line.memo,
              amount: line.debit,
            });
          }
        });
      });

    output.sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());
    input.sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());

    const totalOutput = output.reduce((s, l) => s + l.amount, 0);
    const totalInput = input.reduce((s, l) => s + l.amount, 0);
    const netDue = totalOutput - totalInput;

    return { output, input, totalOutput, totalInput, netDue };
  }, [entries, range]);

  const handleExport = () => {
    const summary = [
      { Item: 'Output VAT (collected on sales)', Amount: data.totalOutput },
      { Item: 'Input VAT (paid on purchases)', Amount: data.totalInput },
      { Item: 'Net VAT Due', Amount: data.netDue },
    ];
    const outputRows = data.output.map(l => ({ Date: fmtDate(l.posted_at), Source: l.source_type, Transaction: l.transaction_id, Memo: l.memo, 'Output VAT': l.amount }));
    const inputRows = data.input.map(l => ({ Date: fmtDate(l.posted_at), Source: l.source_type, Transaction: l.transaction_id, Memo: l.memo, 'Input VAT': l.amount }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(outputRows), 'Output VAT');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inputRows), 'Input VAT');
    XLSX.writeFile(wb, `VAT_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>VAT Report</CardTitle>
            <p className="text-sm text-muted-foreground">Output VAT collected vs. input VAT paid, with net VAT due</p>
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
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <Card><CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Output VAT (Sales)</div>
                  <div className="text-2xl font-bold font-mono text-emerald-600">{fmtMoney(data.totalOutput)}</div>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Input VAT (Purchases)</div>
                  <div className="text-2xl font-bold font-mono text-blue-600">{fmtMoney(data.totalInput)}</div>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Net VAT Due</div>
                  <div className={`text-2xl font-bold font-mono ${data.netDue >= 0 ? 'text-destructive' : 'text-green-600'}`}>{fmtMoney(data.netDue)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {data.netDue >= 0 ? 'Payable to tax authority' : 'Refundable from tax authority'}
                  </div>
                </CardContent></Card>
              </div>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">Output VAT — {data.output.length} transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[110px]">Date</TableHead>
                        <TableHead className="w-[100px]">Source</TableHead>
                        <TableHead>Memo</TableHead>
                        <TableHead className="text-right w-[140px]">Output VAT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.output.map((l, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{fmtDate(l.posted_at)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{l.source_type}</Badge></TableCell>
                          <TableCell className="text-sm">{l.memo}</TableCell>
                          <TableCell className="text-right font-mono">{fmtMoney(l.amount)}</TableCell>
                        </TableRow>
                      ))}
                      {data.output.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No output VAT in range</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">Input VAT — {data.input.length} transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[110px]">Date</TableHead>
                        <TableHead className="w-[100px]">Source</TableHead>
                        <TableHead>Memo</TableHead>
                        <TableHead className="text-right w-[140px]">Input VAT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.input.map((l, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{fmtDate(l.posted_at)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{l.source_type}</Badge></TableCell>
                          <TableCell className="text-sm">{l.memo}</TableCell>
                          <TableCell className="text-right font-mono">{fmtMoney(l.amount)}</TableCell>
                        </TableRow>
                      ))}
                      {data.input.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No input VAT in range</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
