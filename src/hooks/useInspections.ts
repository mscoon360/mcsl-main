import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface Inspection {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  inspection_date: string;
  status: string;
  notes: string | null;
  photos: string[];
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useInspections() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: inspections = [], isLoading } = useQuery({
    queryKey: ["inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select(`
          *,
          fleet_vehicles(make, model, license_plate)
        `)
        .order("inspection_date", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const updateInspectionStatus = useMutation({
    mutationFn: async ({ 
      id, 
      status 
    }: { 
      id: string; 
      status: "passed" | "failed";
    }) => {
      if (!user) throw new Error("User not authenticated");

      // First get the inspection to find the vehicle_id
      const { data: inspection, error: fetchError } = await supabase
        .from("inspections")
        .select("vehicle_id")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Update the inspection status
      const { data, error } = await supabase
        .from("inspections")
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Update the vehicle status based on inspection result
      if (inspection.vehicle_id) {
        const vehicleStatus = status === "passed" ? "active" : "inspection failed";
        const { error: vehicleError } = await supabase
          .from("fleet_vehicles")
          .update({ status: vehicleStatus })
          .eq("id", inspection.vehicle_id);

        if (vehicleError) throw vehicleError;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
      queryClient.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      toast({
        title: "Inspection Updated",
        description: `Inspection marked as ${variables.status}. Vehicle status updated.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update inspection: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return {
    inspections,
    isLoading,
    updateInspectionStatus,
  };
}
