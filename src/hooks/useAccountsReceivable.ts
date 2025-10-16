import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AccountReceivable {
  id: string;
  user_id: string;
  customer_id?: string;
  customer_name: string;
  invoice_id?: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: string;
  description?: string;
  payment_date?: string;
  payment_method?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const useAccountsReceivable = () => {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<AccountReceivable[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts_receivable')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;
      setInvoices((data || []) as AccountReceivable[]);
    } catch (error: any) {
      console.error('Error fetching receivables:', error);
      toast({
        title: 'Error loading receivables',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addReceivable = async (receivable: Omit<AccountReceivable, 'id' | 'user_id' | 'amount_paid'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('accounts_receivable')
        .insert([{ ...receivable, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Receivable added', description: 'Invoice recorded successfully.' });
      await fetchInvoices();
      return data;
    } catch (error: any) {
      console.error('Error adding receivable:', error);
      toast({ title: 'Error adding receivable', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const updateReceivable = async (id: string, updates: Partial<AccountReceivable>) => {
    try {
      const { error } = await supabase
        .from('accounts_receivable')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Receivable updated', description: 'Invoice updated successfully.' });
      await fetchInvoices();
    } catch (error: any) {
      console.error('Error updating receivable:', error);
      toast({ title: 'Error updating receivable', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const deleteReceivable = async (id: string) => {
    try {
      const { error } = await supabase
        .from('accounts_receivable')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setInvoices(prev => prev.filter(i => i.id !== id));
      toast({ title: 'Receivable deleted', description: 'Invoice has been removed.' });
    } catch (error: any) {
      console.error('Error deleting receivable:', error);
      toast({ title: 'Error deleting receivable', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  useEffect(() => {
    fetchInvoices();

    const channel = supabase
      .channel('accounts-receivable-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts_receivable' },
        () => fetchInvoices()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { invoices, loading, addReceivable, updateReceivable, deleteReceivable, refetch: fetchInvoices };
};
