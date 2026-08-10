import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type ProductAccountField = 'revenue_account_code' | 'cogs_account_code' | 'inventory_account_code';

export interface ProductAccountMapping {
  id?: string;
  user_id?: string;
  product_id: string;
  payment_term?: string | null;
  revenue_account_code?: string | null;
  cogs_account_code?: string | null;
  inventory_account_code?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const useProductAccountMappings = () => {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<ProductAccountMapping[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMappings = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('product_account_mappings')
        .select('*');
      if (error) throw error;
      setMappings((data || []) as ProductAccountMapping[]);
    } catch (error: any) {
      console.error('Error fetching product account mappings:', error);
      toast({ title: 'Error loading product mappings', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const setAccount = async (product_id: string, field: ProductAccountField, account_code: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const existing = mappings.find(m => m.product_id === product_id);
      const payload = {
        user_id: user.id,
        product_id,
        revenue_account_code: existing?.revenue_account_code ?? null,
        cogs_account_code: existing?.cogs_account_code ?? null,
        inventory_account_code: existing?.inventory_account_code ?? null,
        [field]: account_code,
      };

      const { error } = await (supabase as any)
        .from('product_account_mappings')
        .upsert(payload, { onConflict: 'user_id,product_id' });
      if (error) throw error;
      await fetchMappings();
    } catch (error: any) {
      console.error('Error saving product mapping:', error);
      toast({ title: 'Error saving mapping', description: error.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchMappings();
    const channel = supabase
      .channel('product-account-mappings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_account_mappings' }, () => fetchMappings())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const getFor = (product_id: string) => mappings.find(m => m.product_id === product_id);

  return { mappings, loading, setAccount, getFor, refetch: fetchMappings };
};
