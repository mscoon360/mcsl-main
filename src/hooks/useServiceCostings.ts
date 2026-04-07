import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ServiceCosting {
  id: string;
  service_id: string;
  payment_term: string;
  rental_price: number;
  unit_cost?: number;
  refill_cost?: number;
  battery_cost?: number;
  battery_frequency_months?: number;
  indirect_cost_percentage?: number;
  margin_percentage?: number;
  total_direct_costs?: number;
  total_cost?: number;
  notes?: string;
}

export const useServiceCostings = () => {
  const [costings, setCostings] = useState<ServiceCosting[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCostings = async () => {
    try {
      const { data, error } = await supabase
        .from('service_costings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCostings((data as any[]) || []);
    } catch (error: any) {
      console.error('Error fetching service costings:', error);
      toast({
        title: 'Error loading service costings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addCosting = async (costing: Omit<ServiceCosting, 'id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('service_costings')
        .insert([{ ...costing, user_id: user.id } as any])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Service costing added',
        description: 'Costing record has been created.',
      });

      await fetchCostings();
      return data;
    } catch (error: any) {
      console.error('Error adding service costing:', error);
      toast({
        title: 'Error adding service costing',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateCosting = async (id: string, updates: Partial<ServiceCosting>) => {
    try {
      const { error } = await supabase
        .from('service_costings')
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;

      setCostings(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      toast({
        title: 'Service costing updated',
        description: 'Costing record has been updated.',
      });
    } catch (error: any) {
      console.error('Error updating service costing:', error);
      toast({
        title: 'Error updating service costing',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteCosting = async (id: string) => {
    try {
      const { error } = await supabase
        .from('service_costings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCostings(prev => prev.filter(c => c.id !== id));
      toast({
        title: 'Service costing deleted',
        description: 'Costing record has been removed.',
      });
    } catch (error: any) {
      console.error('Error deleting service costing:', error);
      toast({
        title: 'Error deleting service costing',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const getCostingsForService = (serviceId: string) => {
    return costings.filter(c => c.service_id === serviceId);
  };

  useEffect(() => {
    fetchCostings();

    const channel = supabase
      .channel('service-costings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_costings' },
        () => { fetchCostings(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return {
    costings,
    loading,
    addCosting,
    updateCosting,
    deleteCosting,
    getCostingsForService,
    refetch: fetchCostings,
  };
};
