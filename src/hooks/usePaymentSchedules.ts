import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PaymentSchedule {
  id: string;
  sale_id?: string;
  customer: string;
  product: string;
  amount: number;
  due_date: string;
  status: 'paid' | 'pending' | 'overdue';
  paid_date?: string;
  payment_method?: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
}

export const usePaymentSchedules = () => {
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPaymentSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_schedules')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;
      setPaymentSchedules((data || []) as PaymentSchedule[]);
    } catch (error: any) {
      console.error('Error fetching payment schedules:', error);
      toast({
        title: 'Error loading payment schedules',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addPaymentSchedule = async (schedule: Omit<PaymentSchedule, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('payment_schedules')
        .insert([{ ...schedule, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      
      setPaymentSchedules(prev => [...prev, data as PaymentSchedule]);
      return data as PaymentSchedule;
    } catch (error: any) {
      console.error('Error adding payment schedule:', error);
      toast({
        title: 'Error adding payment schedule',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updatePaymentSchedule = async (id: string, updates: Partial<PaymentSchedule>) => {
    try {
      const { error } = await supabase
        .from('payment_schedules')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      setPaymentSchedules(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      toast({
        title: 'Payment schedule updated',
        description: 'Payment schedule has been updated successfully.',
      });
    } catch (error: any) {
      console.error('Error updating payment schedule:', error);
      toast({
        title: 'Error updating payment schedule',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deletePaymentSchedule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('payment_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setPaymentSchedules(prev => prev.filter(p => p.id !== id));
      toast({
        title: 'Payment schedule deleted',
        description: 'Payment schedule has been removed successfully.',
      });
    } catch (error: any) {
      console.error('Error deleting payment schedule:', error);
      toast({
        title: 'Error deleting payment schedule',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchPaymentSchedules();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('payment-schedules-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_schedules'
        },
        () => {
          fetchPaymentSchedules();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    paymentSchedules,
    loading,
    addPaymentSchedule,
    updatePaymentSchedule,
    deletePaymentSchedule,
    refetch: fetchPaymentSchedules,
  };
};
