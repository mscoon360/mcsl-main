import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Subdivision {
  id: string;
  division_id: string;
  name: string;
  created_at: string;
}

export interface Division {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  subdivisions?: Subdivision[];
}

export const useDivisions = () => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDivisions = async () => {
    try {
      const { data: divisionsData, error: divisionsError } = await supabase
        .from('divisions')
        .select('*')
        .order('created_at', { ascending: true });

      if (divisionsError) throw divisionsError;

      // Fetch subdivisions for all divisions
      const { data: subdivisionsData, error: subdivisionsError } = await supabase
        .from('subdivisions')
        .select('*')
        .order('created_at', { ascending: true });

      if (subdivisionsError) throw subdivisionsError;

      // Combine divisions with their subdivisions
      const divisionsWithSubdivisions = divisionsData?.map(division => ({
        ...division,
        subdivisions: subdivisionsData?.filter(sub => sub.division_id === division.id) || []
      })) || [];

      setDivisions(divisionsWithSubdivisions);
    } catch (error) {
      console.error('Error fetching divisions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load divisions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addDivision = async (divisionName: string, subdivisionNames: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Insert division
      const { data: division, error: divisionError } = await supabase
        .from('divisions')
        .insert([{ name: divisionName, user_id: user.id }])
        .select()
        .single();

      if (divisionError) throw divisionError;

      // Insert subdivisions
      if (subdivisionNames.length > 0) {
        const subdivisions = subdivisionNames.map(name => ({
          division_id: division.id,
          name
        }));

        const { error: subdivisionsError } = await supabase
          .from('subdivisions')
          .insert(subdivisions);

        if (subdivisionsError) throw subdivisionsError;
      }

      toast({
        title: 'Success',
        description: 'Division created successfully',
      });

      fetchDivisions();
      return division;
    } catch (error) {
      console.error('Error adding division:', error);
      toast({
        title: 'Error',
        description: 'Failed to create division',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateDivision = async (id: string, divisionName: string, subdivisionNames: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Update division name
      const { error: divisionError } = await supabase
        .from('divisions')
        .update({ name: divisionName })
        .eq('id', id);

      if (divisionError) throw divisionError;

      // Get existing subdivisions
      const { data: existingSubdivisions, error: fetchError } = await supabase
        .from('subdivisions')
        .select('*')
        .eq('division_id', id);

      if (fetchError) throw fetchError;

      // Delete removed subdivisions
      if (existingSubdivisions && existingSubdivisions.length > subdivisionNames.length) {
        const toDelete = existingSubdivisions.slice(subdivisionNames.length);
        for (const sub of toDelete) {
          await supabase.from('subdivisions').delete().eq('id', sub.id);
        }
      }

      // Update or insert subdivisions
      for (let i = 0; i < subdivisionNames.length; i++) {
        if (existingSubdivisions && existingSubdivisions[i]) {
          // Update existing
          await supabase
            .from('subdivisions')
            .update({ name: subdivisionNames[i] })
            .eq('id', existingSubdivisions[i].id);
        } else {
          // Insert new
          await supabase
            .from('subdivisions')
            .insert({
              division_id: id,
              name: subdivisionNames[i],
            });
        }
      }

      toast({
        title: 'Success',
        description: 'Division updated successfully',
      });

      fetchDivisions();
    } catch (error: any) {
      console.error('Error updating division:', error);
      toast({
        title: 'Error',
        description: 'Failed to update division',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteDivision = async (id: string) => {
    try {
      const { error } = await supabase
        .from('divisions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Division deleted successfully',
      });

      fetchDivisions();
    } catch (error) {
      console.error('Error deleting division:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete division',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchDivisions();

    // Set up realtime subscription
    const channel = supabase
      .channel('divisions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'divisions' }, fetchDivisions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subdivisions' }, fetchDivisions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    divisions,
    loading,
    addDivision,
    updateDivision,
    deleteDivision,
    refetch: fetchDivisions,
  };
};