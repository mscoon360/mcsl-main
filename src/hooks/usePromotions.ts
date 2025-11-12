import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Promotion {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed' | 'none';
  discount_value: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  bundle_items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    discount_type: 'percentage' | 'fixed' | 'none';
    discount_value: number;
  }>;
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

      setPromotions((data || []) as Promotion[]);
    } catch (error) {
      console.error('Error fetching promotions:', error);
      toast.error('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  const addPromotion = async (promotion: Omit<Promotion, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('promotions')
        .insert([{
          ...promotion,
          user_id: user.id,
        }]);

      if (error) throw error;

      toast.success('Promotion created successfully');
      fetchPromotions();
    } catch (error) {
      console.error('Error creating promotion:', error);
      toast.error('Failed to create promotion');
    }
  };

  const updatePromotion = async (id: string, promotion: Partial<Omit<Promotion, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .update(promotion)
        .eq('id', id);

      if (error) throw error;

      toast.success('Promotion updated successfully');
      fetchPromotions();
    } catch (error) {
      console.error('Error updating promotion:', error);
      toast.error('Failed to update promotion');
    }
  };

  const deletePromotion = async (id: string) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Promotion deleted successfully');
      fetchPromotions();
    } catch (error) {
      console.error('Error deleting promotion:', error);
      toast.error('Failed to delete promotion');
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