import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  rental_price?: number;
  sku: string;
  category?: string;
  division_id?: string;
  subdivision_id?: string;
  status: string;
  is_rental?: boolean;
  is_rental_only?: boolean;
  supplier_name?: string;
  cost_price?: number;
  needs_servicing?: boolean;
  service_frequency?: string;
}

export const useServices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServices((data as any[]) || []);
    } catch (error: any) {
      console.error('Error fetching services:', error);
      toast({
        title: 'Error loading services',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addService = async (service: Omit<Service, 'id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('services')
        .insert([{ ...service, user_id: user.id } as any])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Service added',
        description: 'Service has been added successfully.',
      });

      return data;
    } catch (error: any) {
      console.error('Error adding service:', error);
      toast({
        title: 'Error adding service',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateService = async (id: string, updates: Partial<Service>) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .update(updates as any)
        .eq('id', id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('Permission denied or service not found.');
      }

      setServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      toast({
        title: 'Service updated',
        description: 'Service has been updated successfully.',
      });
    } catch (error: any) {
      console.error('Error updating service:', error);
      toast({
        title: 'Error updating service',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteService = async (id: string) => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setServices(prev => prev.filter(s => s.id !== id));
      toast({
        title: 'Service deleted',
        description: 'Service has been removed successfully.',
      });
    } catch (error: any) {
      console.error('Error deleting service:', error);
      toast({
        title: 'Error deleting service',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchServices();

    const channel = supabase
      .channel('services-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'services' },
        () => { fetchServices(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return {
    services,
    loading,
    addService,
    updateService,
    deleteService,
    refetch: fetchServices,
  };
};
