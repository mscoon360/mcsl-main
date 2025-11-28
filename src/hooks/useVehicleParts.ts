import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface VehiclePart {
  id: string;
  user_id: string;
  vehicle_id: string;
  part_name: string;
  part_category: string | null;
  installation_date: string;
  lifespan_months: number;
  next_replacement_date: string;
  cost: number | null;
  supplier: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useVehicleParts() {
  const [vehicleParts, setVehicleParts] = useState<VehiclePart[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchVehicleParts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicle_parts')
        .select('*')
        .order('installation_date', { ascending: false });

      if (error) throw error;
      setVehicleParts((data || []) as VehiclePart[]);
    } catch (error) {
      console.error('Error fetching vehicle parts:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch vehicle parts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addVehiclePart = async (part: Omit<VehiclePart, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('vehicle_parts')
        .insert([{ ...part, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setVehicleParts(prev => [data as VehiclePart, ...prev]);
      toast({
        title: 'Success',
        description: 'Vehicle part added successfully',
      });
      return data;
    } catch (error) {
      console.error('Error adding vehicle part:', error);
      toast({
        title: 'Error',
        description: 'Failed to add vehicle part',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateVehiclePart = async (id: string, updates: Partial<Omit<VehiclePart, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('vehicle_parts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setVehicleParts(prev => prev.map(p => p.id === id ? data as VehiclePart : p));
      toast({
        title: 'Success',
        description: 'Vehicle part updated successfully',
      });
      return data;
    } catch (error) {
      console.error('Error updating vehicle part:', error);
      toast({
        title: 'Error',
        description: 'Failed to update vehicle part',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteVehiclePart = async (id: string) => {
    try {
      const { error } = await supabase
        .from('vehicle_parts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setVehicleParts(prev => prev.filter(p => p.id !== id));
      toast({
        title: 'Success',
        description: 'Vehicle part deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting vehicle part:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete vehicle part',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchVehicleParts();

    const channel = supabase
      .channel('vehicle_parts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_parts' }, fetchVehicleParts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { vehicleParts, loading, addVehiclePart, updateVehiclePart, deleteVehiclePart, refetch: fetchVehicleParts };
}
