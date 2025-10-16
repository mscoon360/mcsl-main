import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type AccountType = Database['public']['Enums']['account_type'];
type AccountSubtype = Database['public']['Enums']['account_subtype'];

export interface ChartOfAccount {
  id: string;
  user_id: string;
  account_number: string;
  account_name: string;
  account_type: AccountType;
  account_subtype: AccountSubtype;
  parent_account_id?: string | null;
  description?: string | null;
  balance: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const useChartOfAccounts = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .order('account_number', { ascending: true });

      if (error) throw error;
      setAccounts((data || []) as ChartOfAccount[]);
    } catch (error: any) {
      console.error('Error fetching accounts:', error);
      toast({
        title: 'Error loading accounts',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addAccount = async (account: Omit<ChartOfAccount, 'id' | 'user_id' | 'balance'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('chart_of_accounts')
        .insert([{ ...account, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Account added', description: 'Account created successfully.' });
      await fetchAccounts();
      return data;
    } catch (error: any) {
      console.error('Error adding account:', error);
      toast({ title: 'Error adding account', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const updateAccount = async (id: string, updates: Partial<ChartOfAccount>) => {
    try {
      const { error } = await supabase
        .from('chart_of_accounts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Account updated', description: 'Account updated successfully.' });
      await fetchAccounts();
    } catch (error: any) {
      console.error('Error updating account:', error);
      toast({ title: 'Error updating account', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      const { error } = await supabase
        .from('chart_of_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAccounts(prev => prev.filter(a => a.id !== id));
      toast({ title: 'Account deleted', description: 'Account has been removed.' });
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast({ title: 'Error deleting account', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  useEffect(() => {
    fetchAccounts();

    const channel = supabase
      .channel('chart-of-accounts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chart_of_accounts' },
        () => fetchAccounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { accounts, loading, addAccount, updateAccount, deleteAccount, refetch: fetchAccounts };
};
