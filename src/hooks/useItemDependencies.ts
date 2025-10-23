import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ItemDependency {
  id: string;
  product_id: string;
  servicing_frequency: string;
  description?: string;
  last_serviced_date?: string;
  next_service_date?: string;
  created_at?: string;
  updated_at?: string;
  user_id: string;
}

export const useItemDependencies = (productId?: string) => {
  const [dependencies, setDependencies] = useState<ItemDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDependencies = async () => {
    try {
      let query = supabase
        .from('item_dependencies')
        .select('*')
        .order('created_at', { ascending: false });

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDependencies(data || []);
    } catch (error: any) {
      console.error('Error fetching item dependencies:', error);
      toast({
        title: 'Error loading dependencies',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addDependency = async (dependency: Omit<ItemDependency, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('item_dependencies')
        .insert([{ ...dependency, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      
      setDependencies(prev => [data, ...prev]);
      toast({
        title: 'Dependency added',
        description: 'Item dependency has been added successfully.',
      });
      
      return data;
    } catch (error: any) {
      console.error('Error adding dependency:', error);
      toast({
        title: 'Error adding dependency',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateDependency = async (id: string, updates: Partial<ItemDependency>) => {
    try {
      const { error } = await supabase
        .from('item_dependencies')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      setDependencies(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
      toast({
        title: 'Dependency updated',
        description: 'Item dependency has been updated successfully.',
      });
    } catch (error: any) {
      console.error('Error updating dependency:', error);
      toast({
        title: 'Error updating dependency',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteDependency = async (id: string) => {
    try {
      const { error } = await supabase
        .from('item_dependencies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setDependencies(prev => prev.filter(d => d.id !== id));
      toast({
        title: 'Dependency deleted',
        description: 'Item dependency has been removed successfully.',
      });
    } catch (error: any) {
      console.error('Error deleting dependency:', error);
      toast({
        title: 'Error deleting dependency',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchDependencies();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('item-dependencies-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'item_dependencies'
        },
        () => {
          fetchDependencies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId]);

  return {
    dependencies,
    loading,
    addDependency,
    updateDependency,
    deleteDependency,
    refetch: fetchDependencies,
  };
};
