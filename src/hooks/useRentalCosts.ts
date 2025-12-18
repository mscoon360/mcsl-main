import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export type CostCategory = 'labour' | 'vehicles' | 'supplies' | 'contingency' | 'other';

export interface RentalCostItem {
  id: string;
  rental_cost_id: string;
  category: CostCategory;
  
  name: string;
  description: string | null;
  quantity: number;
  unit_cost: number;
  usage_rate: string | null;
  monthly_cost: number;
  annual_cost: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface RentalProductCost {
  id: string;
  product_id: string;
  unit_cost: number;
  refill_cost: number;
  battery_cost: number;
  battery_frequency_months: number;
  indirect_cost_percentage: number;
  notes: string | null;
  prepared_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  items?: RentalCostItem[];
}

export function useRentalCosts() {
  const [rentalCosts, setRentalCosts] = useState<RentalProductCost[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchRentalCosts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: costs, error } = await supabase
        .from('rental_product_costs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch items for each cost
      const costsWithItems = await Promise.all(
        (costs || []).map(async (cost) => {
          const { data: items } = await supabase
            .from('rental_cost_items')
            .select('*')
            .eq('rental_cost_id', cost.id)
            .order('category', { ascending: true });
          
          return {
            ...cost,
            items: (items || []) as RentalCostItem[]
          };
        })
      );

      setRentalCosts(costsWithItems);
    } catch (error: any) {
      console.error('Error fetching rental costs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch rental costs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getRentalCostByProductId = async (productId: string): Promise<RentalProductCost | null> => {
    try {
      const { data: cost, error } = await supabase
        .from('rental_product_costs')
        .select('*')
        .eq('product_id', productId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!cost) return null;

      const { data: items } = await supabase
        .from('rental_cost_items')
        .select('*')
        .eq('rental_cost_id', cost.id)
        .order('category', { ascending: true });

      return {
        ...cost,
        items: (items || []) as RentalCostItem[]
      };
    } catch (error: any) {
      console.error('Error fetching rental cost:', error);
      return null;
    }
  };

  const createRentalCost = async (data: Omit<RentalProductCost, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'items'>) => {
    if (!user) return null;

    try {
      const { data: newCost, error } = await supabase
        .from('rental_product_costs')
        .insert({
          ...data,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Rental cost created successfully"
      });

      await fetchRentalCosts();
      return newCost;
    } catch (error: any) {
      console.error('Error creating rental cost:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create rental cost",
        variant: "destructive"
      });
      return null;
    }
  };

  const updateRentalCost = async (id: string, data: Partial<RentalProductCost>) => {
    try {
      const { error } = await supabase
        .from('rental_product_costs')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Rental cost updated successfully"
      });

      await fetchRentalCosts();
      return true;
    } catch (error: any) {
      console.error('Error updating rental cost:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update rental cost",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteRentalCost = async (id: string) => {
    try {
      const { error } = await supabase
        .from('rental_product_costs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Rental cost deleted successfully"
      });

      await fetchRentalCosts();
      return true;
    } catch (error: any) {
      console.error('Error deleting rental cost:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete rental cost",
        variant: "destructive"
      });
      return false;
    }
  };

  // Cost Item CRUD operations
  const addCostItem = async (data: Omit<RentalCostItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null;

    try {
      const { data: newItem, error } = await supabase
        .from('rental_cost_items')
        .insert({
          ...data,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Cost item added successfully"
      });

      await fetchRentalCosts();
      return newItem;
    } catch (error: any) {
      console.error('Error adding cost item:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add cost item",
        variant: "destructive"
      });
      return null;
    }
  };

  const updateCostItem = async (id: string, data: Partial<RentalCostItem>) => {
    try {
      const { error } = await supabase
        .from('rental_cost_items')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Cost item updated successfully"
      });

      await fetchRentalCosts();
      return true;
    } catch (error: any) {
      console.error('Error updating cost item:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update cost item",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteCostItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('rental_cost_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Cost item deleted successfully"
      });

      await fetchRentalCosts();
      return true;
    } catch (error: any) {
      console.error('Error deleting cost item:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete cost item",
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    fetchRentalCosts();
  }, [user]);

  return {
    rentalCosts,
    loading,
    fetchRentalCosts,
    getRentalCostByProductId,
    createRentalCost,
    updateRentalCost,
    deleteRentalCost,
    addCostItem,
    updateCostItem,
    deleteCostItem
  };
}
