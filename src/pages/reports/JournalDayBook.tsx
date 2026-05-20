import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { useLedgerEntries } from '@/hooks/useLedgerEntries';
import { useChartOfAccounts } from '@/hooks/useChartOfAccounts';
import { DateRangePicker } from './DateRangePicker';
import { DatePreset, DateRange, exportSheet, fmtDate, fmtMoney, inRange, presetRange } from './reportUtils';

export default function JournalDayBook() {
  const { entries, loading } = useLedgerEntries();
  const { accounts } = useChartOfAccounts();
  const [preset, setPreset] = useState<DatePreset>('this-month');
  const [range, setRange] = useState<DateRange>(presetRange('this-month'));
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const accountName = useMemo(() => {
    const m: Record<string, string> = {};
    accounts.forEach(a => { m[a.account_number] = a.account_name; });
    return m;
  }, [accounts]);

  const journals = useMemo(() => {
    return entries
      .filter(e => e.status === 'posted')
      .filter(e => inRange(e.posted_at, range))
      .filter(e => sourceFilter === 'all' || e.source_type === sourceFilter)
      .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());
  }, [entries, range, sourceFilter]);

  const handleExport = () => {
    const rows = journals.flatMap(j =>
      j.entries.map((line, idx) => ({
        Date: idx === 0 ? fmtDate(j.posted_at) : '',
        'Journal ID': idx === 0 ? j.transaction_id : '',
        Source: idx === 0 ? j.source_type : '',
        'Account Code': line.account_code,
        'Account Name': accountName[line.account_code] ?? '',
        Memo: line.memo,
        Debit: line.debit || 0,
        Credit: line.credit || 0,
      }))
    );
    exportSheet('Journal_Day_Book', 'Day Book', rows, [12, 26, 14, 22, 32, 40, 14, 14]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Journal Day Book</CardTitle>
            <p className="text-sm text-muted-foreground">Every posted journal entry grouped by transaction</p>
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
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading…</div>
          ) : journals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No journals in range</div>
          ) : (
            <div className="space-y-4">
              {journals.map(j => (
                <Card key={j.id} className="border-muted">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{fmtDate(j.posted_at)}</span>
                        <Badge variant="outline">{j.source_type}</Badge>
                        <span className="text-xs font-mono text-muted-foreground">#{j.transaction_id}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        DR {fmtMoney(j.total_debit)} / CR {fmtMoney(j.total_credit)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">Account</TableHead>
                          <TableHead>Memo</TableHead>
                          <TableHead className="text-right w-[120px]">Debit</TableHead>
                          <TableHead className="text-right w-[120px]">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {j.entries.map((line, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">
                              <div>{line.account_code}</div>
                              <div className="text-muted-foreground">{accountName[line.account_code] ?? ''}</div>
                            </TableCell>
                            <TableCell className="text-sm">{line.memo}</TableCell>
                            <TableCell className="text-right font-mono">{line.debit ? fmtMoney(line.debit) : ''}</TableCell>
                            <TableCell className="text-right font-mono">{line.credit ? fmtMoney(line.credit) : ''}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
