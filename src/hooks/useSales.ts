import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SaleWithRep {
  id: string;
  customer_name: string;
  total: number;
  date: string;
  status: string;
  user_id: string;
  rep_name: string;
  rep_username: string;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    price: number;
  }>;
}

export function useSales() {
  const [sales, setSales] = useState<SaleWithRep[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchSales = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch sales with profile information
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .order('date', { ascending: false });

      if (salesError) throw salesError;

      // Fetch profiles separately to avoid foreign key issues
      const userIds = [...new Set((salesData || []).map(sale => sale.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, username')
        .in('id', userIds);

      // Fetch all sale items
      const { data: itemsData, error: itemsError } = await supabase
        .from('sale_items')
        .select('*');

      if (itemsError) throw itemsError;

      // Create profile lookup map
      const profileMap = new Map(
        (profilesData || []).map(profile => [profile.id, profile])
      );

      // Combine sales with items and profile info
      const salesWithItems: SaleWithRep[] = (salesData || []).map(sale => {
        const profile = profileMap.get(sale.user_id);
        return {
          id: sale.id,
          customer_name: sale.customer_name,
          total: Number(sale.total),
          date: sale.date,
          status: sale.status || 'completed',
          user_id: sale.user_id,
          rep_name: profile?.name || 'Unknown',
          rep_username: profile?.username || 'Unknown',
          items: (itemsData || [])
            .filter(item => item.sale_id === sale.id)
            .map(item => ({
              id: item.id,
              product_name: item.product_name,
              quantity: item.quantity,
              price: Number(item.price)
            }))
        };
      });

      setSales(salesWithItems);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();

    // Subscribe to changes
    const channel = supabase
      .channel('sales_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, fetchSales)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, fetchSales)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { sales, loading, refetch: fetchSales };
}
