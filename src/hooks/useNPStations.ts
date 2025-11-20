import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NPStation {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  is_active: boolean;
}

export const useNPStations = () => {
  return useQuery({
    queryKey: ['np-stations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('np_stations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as NPStation[];
    },
  });
};
