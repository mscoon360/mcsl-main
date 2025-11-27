import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AccountPayable {
  id: string;
  user_id: string;
  vendor_id?: string;
  vendor_name: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  subtotal: number;
  vat_amount: number;
  status: string;
  description?: string;
  payment_date?: string;
  payment_method?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const useAccountsPayable = () => {
  const { toast } = useToast();
  const [bills, setBills] = useState<AccountPayable[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBills = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts_payable')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;
      setBills((data || []) as AccountPayable[]);
    } catch (error: any) {
      console.error('Error fetching bills:', error);
      toast({
        title: 'Error loading bills',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addBill = async (bill: Omit<AccountPayable, 'id' | 'user_id' | 'amount_paid'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('accounts_payable')
        .insert([{ ...bill, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Bill added', description: 'Bill recorded successfully.' });
      await fetchBills();
      return data;
    } catch (error: any) {
      console.error('Error adding bill:', error);
      toast({ title: 'Error adding bill', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const updateBill = async (id: string, updates: Partial<AccountPayable>) => {
    try {
      const { error } = await supabase
        .from('accounts_payable')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Bill updated', description: 'Bill updated successfully.' });
      await fetchBills();
    } catch (error: any) {
      console.error('Error updating bill:', error);
      toast({ title: 'Error updating bill', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const deleteBill = async (id: string) => {
    try {
      const { error } = await supabase
        .from('accounts_payable')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setBills(prev => prev.filter(b => b.id !== id));
      toast({ title: 'Bill deleted', description: 'Bill has been removed.' });
    } catch (error: any) {
      console.error('Error deleting bill:', error);
      toast({ title: 'Error deleting bill', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  useEffect(() => {
    fetchBills();

    const channel = supabase
      .channel('accounts-payable-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts_payable' },
        () => fetchBills()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { bills, loading, addBill, updateBill, deleteBill, refetch: fetchBills };
};
