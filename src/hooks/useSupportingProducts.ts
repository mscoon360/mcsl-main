import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SupportingProductRelation {
  id: string;
  product_id: string;
  supporting_product_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export const useSupportingProducts = (productId?: string) => {
  const [supportingProducts, setSupportingProducts] = useState<SupportingProductRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchSupportingProducts = async (id?: string) => {
    const targetId = id || productId;
    if (!targetId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_supporting_items')
        .select('*')
        .eq('product_id', targetId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSupportingProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching supporting products:', error);
      toast({
        title: 'Error loading supporting products',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addSupportingProduct = async (productId: string, supportingProductId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('product_supporting_items')
        .insert([{
          product_id: productId,
          supporting_product_id: supportingProductId,
          user_id: user.id,
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('This product is already added as a supporting product');
        }
        throw error;
      }

      toast({
        title: 'Supporting product added',
        description: 'Supporting product has been linked successfully.',
      });

      return data;
    } catch (error: any) {
      console.error('Error adding supporting product:', error);
      toast({
        title: 'Error adding supporting product',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const removeSupportingProduct = async (relationId: string) => {
    try {
      const { error } = await supabase
        .from('product_supporting_items')
        .delete()
        .eq('id', relationId);

      if (error) throw error;

      setSupportingProducts(prev => prev.filter(sp => sp.id !== relationId));
      
      toast({
        title: 'Supporting product removed',
        description: 'Supporting product has been unlinked successfully.',
      });
    } catch (error: any) {
      console.error('Error removing supporting product:', error);
      toast({
        title: 'Error removing supporting product',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    if (productId) {
      fetchSupportingProducts();
    }
  }, [productId]);

  return {
    supportingProducts,
    loading,
    addSupportingProduct,
    removeSupportingProduct,
    refetch: fetchSupportingProducts,
  };
};
