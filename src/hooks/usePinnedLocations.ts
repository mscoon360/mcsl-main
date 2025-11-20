import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface PinnedLocation {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
}

export const usePinnedLocations = () => {
  const queryClient = useQueryClient();

  const { data: pinnedLocations = [], isLoading } = useQuery({
    queryKey: ['pinned-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pinned_locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PinnedLocation[];
    },
  });

  const addPinnedLocation = useMutation({
    mutationFn: async (location: { name: string; description?: string; latitude: number; longitude: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('pinned_locations')
        .insert({
          user_id: user.id,
          name: location.name,
          description: location.description,
          latitude: location.latitude,
          longitude: location.longitude,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-locations'] });
      toast({
        title: "Location Pinned",
        description: "Your location has been saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save pinned location",
        variant: "destructive",
      });
      console.error('Error adding pinned location:', error);
    },
  });

  const deletePinnedLocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pinned_locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-locations'] });
      toast({
        title: "Location Removed",
        description: "Pinned location has been deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete pinned location",
        variant: "destructive",
      });
      console.error('Error deleting pinned location:', error);
    },
  });

  return {
    pinnedLocations,
    isLoading,
    addPinnedLocation,
    deletePinnedLocation,
  };
};
