import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { X } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useProductAccountMappings, ProductAccountField } from '@/hooks/useProductAccountMappings';
import { ChartOfAccount } from '@/hooks/useChartOfAccounts';

interface Props {
  accounts: ChartOfAccount[];
  accountsLoading: boolean;
}

const PAGE_SIZE = 10;

export function ProductAccountMappingsSection({ accounts, accountsLoading }: Props) {
  const { products, loading: productsLoading } = useProducts();
  const { mappings, loading: mappingsLoading, setAccount, getFor } = useProductAccountMappings();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

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
    const list = q
      ? products.filter(p => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      : products;
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [products, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const paginated = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const mappedCount = mappings.filter(m => m.revenue_account_code || m.cogs_account_code).length;

  const AccountSelect = ({
    productId, field, value, options, placeholder,
  }: { productId: string; field: ProductAccountField; value?: string | null; options: ChartOfAccount[]; placeholder: string }) => (
    <div className="flex items-center gap-1">
      <Select
        value={value || ''}
        onValueChange={(v) => setAccount(productId, field, v)}
        disabled={accountsLoading || mappingsLoading}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No accounts available</div>
          ) : options.map(a => (
            <SelectItem key={a.id} value={a.account_number}>
              <span className="font-mono text-xs">{a.account_number}</span>{' — '}{a.account_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Clear" onClick={() => setAccount(productId, field, null)}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
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
        <Input
          placeholder="Search products by name or SKU…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="max-w-sm"
        />

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
              ) : paginated.map(p => {
                const m = getFor(p.id);
                return (
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
