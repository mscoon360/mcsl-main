import { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useChartOfAccounts, ChartOfAccount } from '@/hooks/useChartOfAccounts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import * as XLSX from 'xlsx';
import type { Database } from '@/integrations/supabase/types';

type AccountType = Database['public']['Enums']['account_type'];
type AccountSubtype = Database['public']['Enums']['account_subtype'];

const accountTypes = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
];

const accountSubtypes: Record<string, { value: string; label: string }[]> = {
  asset: [
    { value: 'current-asset', label: 'Current Asset' },
    { value: 'fixed-asset', label: 'Fixed Asset' },
    { value: 'other-asset', label: 'Other Asset' },
  ],
  liability: [
    { value: 'current-liability', label: 'Current Liability' },
    { value: 'long-term-liability', label: 'Long-term Liability' },
  ],
  equity: [{ value: 'equity', label: 'Equity' }],
  revenue: [
    { value: 'operating-revenue', label: 'Operating Revenue' },
    { value: 'other-revenue', label: 'Other Revenue' },
  ],
  expense: [
    { value: 'cost-of-goods-sold', label: 'Cost of Goods Sold' },
    { value: 'operating-expense', label: 'Operating Expense' },
    { value: 'other-expense', label: 'Other Expense' },
  ],
};

export default function ChartOfAccounts() {
  const { accounts, loading, addAccount, updateAccount, deleteAccount } = useChartOfAccounts();
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSubtype, setFilterSubtype] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<{
    account_number: string;
    account_name: string;
    account_type: AccountType | '';
    account_subtype: AccountSubtype | '';
    description: string;
    is_active: boolean;
  }>({
    account_number: '',
    account_name: '',
    account_type: '',
    account_subtype: '',
    description: '',
    is_active: true,
  });

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter(account => {
      const matchesSearch = searchTerm === '' ||
        account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.account_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (account.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || account.account_type === filterType;
      const matchesSubtype = filterSubtype === 'all' || account.account_subtype === filterSubtype;
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'active' && account.is_active) ||
        (filterStatus === 'inactive' && !account.is_active);
      return matchesSearch && matchesType && matchesSubtype && matchesStatus;
    });
  }, [accounts, searchTerm, filterType, filterSubtype, filterStatus]);

  // Summary stats
  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    accountTypes.forEach(t => { byType[t.value] = 0; });
    accounts.forEach(a => { byType[a.account_type] = (byType[a.account_type] || 0) + 1; });
    const activeCount = accounts.filter(a => a.is_active).length;
    return { byType, total: accounts.length, active: activeCount, inactive: accounts.length - activeCount };
  }, [accounts]);

  // Grouped accounts
  const groupedAccounts = useMemo(() => {
    const grouped: Record<string, ChartOfAccount[]> = {};
    filteredAccounts.forEach(account => {
      if (!grouped[account.account_type]) grouped[account.account_type] = [];
      grouped[account.account_type].push(account);
    });
    return grouped;
  }, [filteredAccounts]);

  // Available subtypes based on selected filter type
  const availableSubtypes = useMemo(() => {
    if (filterType === 'all') {
      return Object.values(accountSubtypes).flat();
    }
    return accountSubtypes[filterType] || [];
  }, [filterType]);

  const toggleGroup = (type: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.account_type || !formData.account_subtype) return;

    const accountData = {
      ...formData,
      account_type: formData.account_type as AccountType,
      account_subtype: formData.account_subtype as AccountSubtype,
    };
    
    if (editingAccount) {
      await updateAccount(editingAccount.id, accountData);
      setEditingAccount(null);
    } else {
      await addAccount(accountData);
    }
    
    setShowForm(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      account_number: '',
      account_name: '',
      account_type: '' as any,
      account_subtype: '',
      description: '',
      is_active: true,
    });
  };

  const handleEdit = (account: ChartOfAccount) => {
    setEditingAccount(account);
    setFormData({
      account_number: account.account_number,
      account_name: account.account_name,
      account_type: account.account_type,
      account_subtype: account.account_subtype,
      description: account.description || '',
      is_active: account.is_active,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingAccount(null);
    resetForm();
  };

  const handleExport = () => {
    const exportData = filteredAccounts.map(a => ({
      'Account Number': a.account_number,
      'Account Name': a.account_name,
      'Type': a.account_type.charAt(0).toUpperCase() + a.account_type.slice(1),
      'Subtype': a.account_subtype.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      'Balance': a.balance,
      'Status': a.is_active ? 'Active' : 'Inactive',
      'Description': a.description || '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { width: 15 }, { width: 40 }, { width: 12 }, { width: 20 },
      { width: 15 }, { width: 10 }, { width: 40 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Chart of Accounts');
    XLSX.writeFile(wb, `Chart_of_Accounts_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      asset: 'bg-green-500/10 text-green-500',
      liability: 'bg-red-500/10 text-red-500',
      equity: 'bg-blue-500/10 text-blue-500',
      revenue: 'bg-emerald-500/10 text-emerald-500',
      expense: 'bg-orange-500/10 text-orange-500',
    };
    return colors[type] || 'bg-gray-500/10 text-gray-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Chart of Accounts</h1>
          <p className="text-muted-foreground">{stats.total} accounts ({stats.active} active, {stats.inactive} inactive)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {accountTypes.map(type => (
          <Card key={type.value} className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => { setFilterType(filterType === type.value ? 'all' : type.value); setFilterSubtype('all'); }}>
            <CardContent className="p-4 text-center">
              <Badge className={`${getTypeColor(type.value)} mb-2`}>{type.label}</Badge>
              <p className="text-2xl font-bold">{stats.byType[type.value] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by account number, name, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => { setFilterType(v); setFilterSubtype('all'); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {accountTypes.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSubtype} onValueChange={setFilterSubtype}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Subtypes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subtypes</SelectItem>
            {availableSubtypes.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      {(searchTerm || filterType !== 'all' || filterSubtype !== 'all' || filterStatus !== 'all') && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredAccounts.length} of {accounts.length} accounts
          </p>
          <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setFilterType('all'); setFilterSubtype('all'); setFilterStatus('all'); }}>
            Clear Filters
          </Button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={handleCancel}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Account' : 'Add New Account'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="1000"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_name">Account Name</Label>
                  <Input
                    id="account_name"
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    placeholder="Cash"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account_type">Account Type</Label>
                  <Select
                    value={formData.account_type}
                    onValueChange={(value) => setFormData({ ...formData, account_type: value as AccountType, account_subtype: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_subtype">Account Subtype</Label>
                  <Select
                    value={formData.account_subtype}
                    onValueChange={(value) => setFormData({ ...formData, account_subtype: value as AccountSubtype })}
                    disabled={!formData.account_type}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subtype" />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.account_type && accountSubtypes[formData.account_type]?.map((subtype) => (
                        <SelectItem key={subtype.value} value={subtype.value}>
                          {subtype.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
              <Button type="submit">{editingAccount ? 'Update' : 'Add'} Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Account Groups */}
      {loading ? (
        <div className="text-center py-8">Loading accounts...</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedAccounts)
            .sort(([a], [b]) => {
              const order = ['asset', 'liability', 'equity', 'revenue', 'expense'];
              return order.indexOf(a) - order.indexOf(b);
            })
            .map(([type, typeAccounts]) => {
              const isCollapsed = collapsedGroups.has(type);
              const typeTotal = typeAccounts.reduce((sum, a) => sum + a.balance, 0);
              return (
                <Card key={type}>
                  <CardHeader 
                    className="cursor-pointer hover:bg-muted/50 transition-colors py-3"
                    onClick={() => toggleGroup(type)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-3">
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <Badge className={getTypeColor(type)}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Badge>
                        <span className="text-sm font-normal text-muted-foreground">
                          {typeAccounts.length} accounts
                        </span>
                      </CardTitle>
                      <span className="text-sm font-mono font-semibold">
                        ${typeTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </CardHeader>
                  {!isCollapsed && (
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[120px]">Number</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Subtype</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead className="w-[80px]">Status</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {typeAccounts.map((account) => (
                            <TableRow key={account.id} className={!account.is_active ? 'opacity-50' : ''}>
                              <TableCell className="font-mono text-sm">{account.account_number}</TableCell>
                              <TableCell className="font-medium">{account.account_name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {account.account_subtype.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </TableCell>
                              <TableCell className="font-mono text-right">
                                ${account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                <Badge variant={account.is_active ? 'default' : 'secondary'} className="text-xs">
                                  {account.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEdit(account); }}>
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); deleteAccount(account.id); }}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          {filteredAccounts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No accounts found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
