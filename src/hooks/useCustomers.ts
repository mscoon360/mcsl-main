import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company: string;
  address?: string;
  city?: string;
  total_sales: number;
  last_purchase?: string;
  status: string;
}

export const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      toast({
        title: 'Error loading customers',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addCustomer = async (customer: Omit<Customer, 'id' | 'total_sales'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('customers')
        .insert([{ ...customer, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      
      setCustomers(prev => [data, ...prev]);
      toast({
        title: 'Customer added',
        description: 'Customer has been added successfully.',
      });
      
      return data;
    } catch (error: any) {
      console.error('Error adding customer:', error);
      toast({
        title: 'Error adding customer',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      toast({
        title: 'Customer updated',
        description: 'Customer has been updated successfully.',
      });
    } catch (error: any) {
      console.error('Error updating customer:', error);
      toast({
        title: 'Error updating customer',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setCustomers(prev => prev.filter(c => c.id !== id));
      toast({
        title: 'Customer deleted',
        description: 'Customer has been removed successfully.',
      });
    } catch (error: any) {
      console.error('Error deleting customer:', error);
      toast({
        title: 'Error deleting customer',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchCustomers();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('customers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers'
        },
        () => {
          fetchCustomers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    customers,
    loading,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    refetch: fetchCustomers,
  };
};
