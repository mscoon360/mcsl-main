import { Fragment, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { X } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useDivisions } from '@/hooks/useDivisions';
import { useProductAccountMappings, ProductAccountField } from '@/hooks/useProductAccountMappings';
import { ChartOfAccount } from '@/hooks/useChartOfAccounts';
import { AccountPicker } from '@/components/finance/AccountPicker';

interface Props {
  accounts: ChartOfAccount[];
  accountsLoading: boolean;
}

const PAGE_SIZE = 10;

export function ProductAccountMappingsSection({ accounts, accountsLoading }: Props) {
  const { products, loading: productsLoading } = useProducts();
  const { divisions } = useDivisions();
  const { mappings, loading: mappingsLoading, setAccount, getFor, getTermsFor } = useProductAccountMappings();
  const [search, setSearch] = useState('');
  const [divisionId, setDivisionId] = useState('all');
  const [subdivisionId, setSubdivisionId] = useState('all');
  const [page, setPage] = useState(0);

  const divisionName = (id?: string | null) => divisions.find(d => d.id === id)?.name || 'Unassigned';
  const subdivisionName = (id?: string | null) =>
    divisions.flatMap(d => d.subdivisions || []).find(s => s.id === id)?.name || 'Unassigned';

  const subdivisionOptions = useMemo(() => {
    const list = divisionId === 'all'
      ? divisions.flatMap(d => d.subdivisions || [])
      : (divisions.find(d => d.id === divisionId)?.subdivisions || []);
    return list;
  }, [divisions, divisionId]);

  const revenueAccounts = useMemo(
    () => accounts.filter(a => a.is_active && a.account_type === 'revenue')
      .sort((a, b) => a.account_number.localeCompare(b.account_number)),
    [accounts]
  );
  const cogsAccounts = useMemo(
    () => accounts.filter(a => a.is_active && (a.account_subtype === 'cost-of-goods-sold' || a.account_type === 'expense'))
      .sort((a, b) => a.account_number.localeCompare(b.account_number)),
    [accounts]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? products.filter(p => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      : products;
    if (divisionId !== 'all') list = list.filter(p => p.division_id === divisionId);
    if (subdivisionId !== 'all') list = list.filter(p => p.subdivision_id === subdivisionId);
    return [...list].sort((a, b) => {
      const d = divisionName(a.division_id).localeCompare(divisionName(b.division_id));
      if (d !== 0) return d;
      const s = subdivisionName(a.subdivision_id).localeCompare(subdivisionName(b.subdivision_id));
      if (s !== 0) return s;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [products, search, divisionId, subdivisionId, divisions]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const paginated = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);


  const mappedCount = new Set(
    mappings.filter(m => m.revenue_account_code || m.cogs_account_code).map(m => m.product_id)
  ).size;

  const AccountSelect = ({
    productId, field, value, options, placeholder, paymentTerm = null,
  }: { productId: string; field: ProductAccountField; value?: string | null; options: ChartOfAccount[]; placeholder: string; paymentTerm?: string | null }) => (
    <AccountPicker
      value={value}
      options={options}
      placeholder={placeholder}
      disabled={accountsLoading || mappingsLoading}
      onChange={(v) => setAccount(productId, field, v, paymentTerm)}
    />
  );


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Product Accounts</CardTitle>
            <CardDescription>
              Map each product to the revenue account its invoiced price posts to, and the COGS account
              used when the item is sold.
            </CardDescription>
          </div>
          <Badge variant="outline">{mappedCount} of {products.length} products mapped</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search products by name or SKU…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="max-w-sm"
          />
          <Select value={divisionId} onValueChange={(v) => { setDivisionId(v); setSubdivisionId('all'); setPage(0); }}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="All divisions" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All divisions</SelectItem>
              {divisions.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={subdivisionId} onValueChange={(v) => { setSubdivisionId(v); setPage(0); }}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="All subdivisions" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All subdivisions</SelectItem>
              {subdivisionOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Product</TableHead>
                <TableHead className="min-w-[120px]">Invoiced Price</TableHead>
                <TableHead className="min-w-[260px]">Revenue Account (CR)</TableHead>
                <TableHead className="min-w-[260px]">COGS Account (DR)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading products…</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No products found</TableCell></TableRow>
              ) : paginated.map((p, idx) => {
                const m = getFor(p.id);
                const groupKey = `${divisionName(p.division_id)} › ${subdivisionName(p.subdivision_id)}`;
                const prev = idx > 0 ? paginated[idx - 1] : null;
                const prevKey = prev ? `${divisionName(prev.division_id)} › ${subdivisionName(prev.subdivision_id)}` : null;
                return (
                  <Fragment key={p.id}>
                    {groupKey !== prevKey && (
                      <TableRow key={`${groupKey}-header`} className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={4} className="py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {groupKey}
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        ${Number(p.price || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <AccountSelect productId={p.id} field="revenue_account_code" value={m?.revenue_account_code} options={revenueAccounts} placeholder="— Select revenue account —" />
                      </TableCell>
                      <TableCell>
                        <AccountSelect productId={p.id} field="cogs_account_code" value={m?.cogs_account_code} options={cogsAccounts} placeholder="— Select COGS account —" />
                      </TableCell>
                    </TableRow>
                    {getTermsFor(p.id).map(t => (
                      <TableRow key={`${p.id}-${t.payment_term}`} className="bg-muted/20">
                        <TableCell className="pl-8">
                          <span className="text-sm text-muted-foreground">Rental term</span>{' '}
                          <Badge variant="secondary" className="capitalize">{t.payment_term}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">per period</TableCell>
                        <TableCell>
                          <AccountSelect productId={p.id} paymentTerm={t.payment_term!} field="revenue_account_code" value={t.revenue_account_code} options={revenueAccounts} placeholder="— Select revenue account —" />
                        </TableCell>
                        <TableCell>
                          <AccountSelect productId={p.id} paymentTerm={t.payment_term!} field="cogs_account_code" value={t.cogs_account_code} options={cogsAccounts} placeholder="— Select COGS account —" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>




        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
