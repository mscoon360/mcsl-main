import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type Workflow = 'sale' | 'expense' | 'payment' | 'refund';

export interface AccountMapping {
  id?: string;
  user_id?: string;
  workflow: Workflow;
  role: string;
  account_code: string;
  created_at?: string;
  updated_at?: string;
}

export const useAccountMappings = () => {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMappings = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('account_mappings')
        .select('*')
        .order('workflow', { ascending: true })
        .order('role', { ascending: true });
      if (error) throw error;
      setMappings((data || []) as AccountMapping[]);
    } catch (error: any) {
      console.error('Error fetching mappings:', error);
      toast({ title: 'Error loading mappings', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const upsertMapping = async (workflow: Workflow, role: string, account_code: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { error } = await supabase
        .from('account_mappings')
        .upsert(
          { user_id: user.id, workflow, role, account_code },
          { onConflict: 'user_id,workflow,role' }
        );
      if (error) throw error;
      await fetchMappings();
    } catch (error: any) {
      console.error('Error saving mapping:', error);
      toast({ title: 'Error saving mapping', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const clearMapping = async (workflow: Workflow, role: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      const { error } = await supabase
        .from('account_mappings')
        .delete()
        .eq('user_id', user.id)
        .eq('workflow', workflow)
        .eq('role', role);
      if (error) throw error;
      await fetchMappings();
    } catch (error: any) {
      console.error('Error clearing mapping:', error);
      toast({ title: 'Error clearing mapping', description: error.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchMappings();
    const channel = supabase
      .channel('account-mappings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_mappings' }, () => fetchMappings())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const get = (workflow: Workflow, role: string) =>
    mappings.find(m => m.workflow === workflow && m.role === role)?.account_code ?? '';

  return { mappings, loading, upsertMapping, clearMapping, get, refetch: fetchMappings };
};
