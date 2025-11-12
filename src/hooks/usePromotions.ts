import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface BundleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  discount_type?: 'percentage' | 'fixed' | 'none';
  discount_value?: number;
}

export interface Promotion {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  discount_type?: 'percentage' | 'fixed' | 'none';
  discount_value: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  bundle_items: BundleItem[];
  created_at: string;
  updated_at: string;
}

export function usePromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchPromotions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromotions((data || []) as unknown as Promotion[]);
    } catch (error) {
      console.error('Error fetching promotions:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch promotions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addPromotion = async (promotion: Omit<Promotion, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('promotions')
        .insert([{ ...promotion, user_id: user.id } as any])
        .select()
        .single();

      if (error) throw error;

      setPromotions(prev => [data as unknown as Promotion, ...prev]);
      toast({
        title: 'Success',
        description: 'Promotion created successfully',
      });
      return data;
    } catch (error) {
      console.error('Error adding promotion:', error);
      toast({
        title: 'Error',
        description: 'Failed to create promotion',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updatePromotion = async (id: string, updates: Partial<Omit<Promotion, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setPromotions(prev => prev.map(p => p.id === id ? data as unknown as Promotion : p));
      toast({
        title: 'Success',
        description: 'Promotion updated successfully',
      });
      return data;
    } catch (error) {
      console.error('Error updating promotion:', error);
      toast({
        title: 'Error',
        description: 'Failed to update promotion',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deletePromotion = async (id: string) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPromotions(prev => prev.filter(p => p.id !== id));
      toast({
        title: 'Success',
        description: 'Promotion deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting promotion:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete promotion',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchPromotions();

    const channel = supabase
      .channel('promotions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promotions' }, fetchPromotions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { promotions, loading, addPromotion, updatePromotion, deletePromotion, refetch: fetchPromotions };
}
