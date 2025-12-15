import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Vendor {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  contact_person?: string;
  payment_terms?: string;
  notes?: string;
  status: string;
  gl_account_number?: string;
  credit_balance?: number;
  created_at?: string;
  updated_at?: string;
}

export const useVendors = () => {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setVendors((data || []) as Vendor[]);
    } catch (error: any) {
      console.error('Error fetching vendors:', error);
      toast({
        title: 'Error loading vendors',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addVendor = async (vendor: Omit<Vendor, 'id' | 'user_id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('vendors')
        .insert([{ ...vendor, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Vendor added', description: 'Vendor created successfully.' });
      await fetchVendors();
      return data;
    } catch (error: any) {
      console.error('Error adding vendor:', error);
      toast({ title: 'Error adding vendor', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const updateVendor = async (id: string, updates: Partial<Vendor>) => {
    try {
      const { error } = await supabase
        .from('vendors')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Vendor updated', description: 'Vendor updated successfully.' });
      await fetchVendors();
    } catch (error: any) {
      console.error('Error updating vendor:', error);
      toast({ title: 'Error updating vendor', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const deleteVendor = async (id: string) => {
    try {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setVendors(prev => prev.filter(v => v.id !== id));
      toast({ title: 'Vendor deleted', description: 'Vendor has been removed.' });
    } catch (error: any) {
      console.error('Error deleting vendor:', error);
      toast({ title: 'Error deleting vendor', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  useEffect(() => {
    fetchVendors();

    const channel = supabase
      .channel('vendors-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendors' },
        () => fetchVendors()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { vendors, loading, addVendor, updateVendor, deleteVendor, refetch: fetchVendors };
};
