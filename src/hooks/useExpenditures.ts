import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ExpenditureRecord {
  id: string;
  user_id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  description: string;
  amount: number;
  category: 'working-capital' | 'fixed-capital';
  type: string;
  created_at?: string;
  updated_at?: string;
}

export const useExpenditures = () => {
  const { toast } = useToast();
  const [expenditures, setExpenditures] = useState<ExpenditureRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenditures = async () => {
    try {
      const { data, error } = await supabase
        .from('expenditures')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setExpenditures((data || []) as ExpenditureRecord[]);
    } catch (error: any) {
      console.error('Error fetching expenditures:', error);
      toast({
        title: 'Error loading expenses',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addExpense = async (expense: Omit<ExpenditureRecord, 'id' | 'user_id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('expenditures')
        .insert([{ ...expense, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Expense added', description: 'Expense recorded successfully.' });
      await fetchExpenditures();
      return data;
    } catch (error: any) {
      console.error('Error adding expense:', error);
      toast({ title: 'Error adding expense', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const { error } = await supabase
        .from('expenditures')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setExpenditures(prev => prev.filter(e => e.id !== id));
      toast({ title: 'Expense deleted', description: 'Expense has been removed.' });
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      toast({ title: 'Error deleting expense', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  useEffect(() => {
    fetchExpenditures();

    const channel = supabase
      .channel('expenditures-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenditures' },
        () => fetchExpenditures()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { expenditures, loading, addExpense, deleteExpense, refetch: fetchExpenditures };
}
