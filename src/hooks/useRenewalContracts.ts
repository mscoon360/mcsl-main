import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { differenceInDays } from 'date-fns';

export interface RenewalContract {
  id: string;
  client: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  value_of_contract_vat: number;
  type_of_billing: string | null;
  billed: boolean;
  type_of_service: string | null;
  zone: string | null;
  contact_number: string | null;
  email: string | null;
  renewal_status: string;
  notes: string | null;
  created_at: string;
  // Computed fields
  daysUntilExpiry: number;
  daysSinceExpiry: number;
  status: 'expiring-soon' | 'recently-expired' | 'active' | 'expired';
}

export function useRenewalContracts() {
  const [contracts, setContracts] = useState<RenewalContract[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchContracts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('renewal_contracts')
        .select('*')
        .order('contract_end_date', { ascending: true });

      if (error) throw error;

      const now = new Date();
      const enrichedContracts: RenewalContract[] = (data || []).map(contract => {
        const endDate = contract.contract_end_date ? new Date(contract.contract_end_date) : null;
        const daysUntilExpiry = endDate ? differenceInDays(endDate, now) : 0;
        const daysSinceExpiry = endDate ? differenceInDays(now, endDate) : 0;

        let status: RenewalContract['status'] = 'active';
        if (endDate) {
          if (daysSinceExpiry > 0 && daysSinceExpiry <= 30) {
            status = 'recently-expired';
          } else if (daysSinceExpiry > 30) {
            status = 'expired';
          } else if (daysUntilExpiry <= 60) {
            status = 'expiring-soon';
          }
        }

        return {
          ...contract,
          daysUntilExpiry: Math.max(0, daysUntilExpiry),
          daysSinceExpiry: Math.max(0, daysSinceExpiry),
          status
        };
      });

      setContracts(enrichedContracts);
    } catch (error) {
      console.error('Error fetching renewal contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();

    const channel = supabase
      .channel('renewal_contracts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'renewal_contracts' }, fetchContracts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const stats = {
    total: contracts.length,
    expiringSoon: contracts.filter(c => c.status === 'expiring-soon').length,
    recentlyExpired: contracts.filter(c => c.status === 'recently-expired').length,
    totalValue: contracts.reduce((sum, c) => sum + (c.value_of_contract_vat || 0), 0)
  };

  return {
    contracts,
    loading,
    stats,
    refetch: fetchContracts
  };
}
