import { useEffect } from "react";
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

  const addInspection = useMutation({
    mutationFn: async (input: {
      vehicle_id: string;
      inspection_date: string;
      status: "pending" | "passed" | "failed";
      notes?: string | null;
      photos?: string[];
    }) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("inspections")
        .insert({
          user_id: user.id,
          vehicle_id: input.vehicle_id,
          inspection_date: input.inspection_date,
          status: input.status,
          notes: input.notes ?? null,
          photos: input.photos ?? [],
        })
        .select()
        .single();

      if (error) throw error;

      // If the inspection is recorded as already passed/failed, update the
      // vehicle status to match so the Fleet page reflects it.
      if (input.status === "passed" || input.status === "failed") {
        const vehicleStatus = input.status === "passed" ? "active" : "inspection failed";
        await supabase
          .from("fleet_vehicles")
          .update({
            status: vehicleStatus,
            last_inspection_date: input.inspection_date,
          })
          .eq("id", input.vehicle_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
      queryClient.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      toast({
        title: "Inspection Recorded",
        description: "The inspection has been added.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add inspection: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("inspections_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "inspections" }, () => {
        queryClient.invalidateQueries({ queryKey: ["inspections"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return {
    inspections,
    isLoading,
    addInspection,
    updateInspectionStatus,
  };
}
