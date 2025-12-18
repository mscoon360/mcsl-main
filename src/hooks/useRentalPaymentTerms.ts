import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export type PaymentTerm = 'weekly' | 'bi-weekly' | 'monthly';

export interface RentalPaymentTerm {
  id: string;
  product_id: string;
  payment_term: PaymentTerm;
  rental_price: number;
  unit_cost: number;
  refill_cost: number;
  battery_cost: number;
  battery_frequency_months: number;
  indirect_cost_percentage: number;
  total_direct_costs: number;
  total_cost: number;
  margin_percentage: number;
  notes: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export function useRentalPaymentTerms() {
  const [paymentTerms, setPaymentTerms] = useState<RentalPaymentTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchPaymentTerms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rental_payment_terms')
        .select('*')
        .order('payment_term', { ascending: true });

      if (error) throw error;
      setPaymentTerms((data || []) as RentalPaymentTerm[]);
    } catch (error: any) {
      console.error('Error fetching payment terms:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPaymentTermsForProduct = async (productId: string): Promise<RentalPaymentTerm[]> => {
    try {
      const { data, error } = await supabase
        .from('rental_payment_terms')
        .select('*')
        .eq('product_id', productId)
        .order('payment_term', { ascending: true });

      if (error) throw error;
      return (data || []) as RentalPaymentTerm[];
    } catch (error: any) {
      console.error('Error fetching payment terms for product:', error);
      return [];
    }
  };

  const createPaymentTerm = async (data: Omit<RentalPaymentTerm, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null;

    try {
      const { data: newTerm, error } = await supabase
        .from('rental_payment_terms')
        .insert({
          ...data,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment term created successfully"
      });

      await fetchPaymentTerms();
      return newTerm;
    } catch (error: any) {
      console.error('Error creating payment term:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create payment term",
        variant: "destructive"
      });
      return null;
    }
  };

  const updatePaymentTerm = async (id: string, data: Partial<RentalPaymentTerm>) => {
    try {
      const { error } = await supabase
        .from('rental_payment_terms')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment term updated successfully"
      });

      await fetchPaymentTerms();
      return true;
    } catch (error: any) {
      console.error('Error updating payment term:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update payment term",
        variant: "destructive"
      });
      return false;
    }
  };

  const deletePaymentTerm = async (id: string) => {
    try {
      const { error } = await supabase
        .from('rental_payment_terms')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment term deleted successfully"
      });

      await fetchPaymentTerms();
      return true;
    } catch (error: any) {
      console.error('Error deleting payment term:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete payment term",
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    fetchPaymentTerms();
  }, []);

  return {
    paymentTerms,
    loading,
    fetchPaymentTerms,
    getPaymentTermsForProduct,
    createPaymentTerm,
    updatePaymentTerm,
    deletePaymentTerm
  };
}
