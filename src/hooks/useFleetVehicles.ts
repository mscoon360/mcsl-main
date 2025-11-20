import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface FleetVehicle {
  id: string;
  user_id: string;
  make: string;
  model: string;
  license_plate: string;
  driver_name: string;
  driver_phone: string;
  mpg: number;
  inspection_cycle: string;
  last_inspection_date?: string;
  next_inspection_date?: string;
  status: string;
  mileage: number;
  created_at: string;
  updated_at: string;
}

export function useFleetVehicles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["fleet-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_vehicles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as FleetVehicle[];
    },
    enabled: !!user,
  });

  const addVehicle = useMutation({
    mutationFn: async (vehicleData: Omit<FleetVehicle, "id" | "user_id" | "created_at" | "updated_at">) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("fleet_vehicles")
        .insert([{ ...vehicleData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      toast({
        title: "Vehicle Added",
        description: "The vehicle has been added to your fleet.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add vehicle: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateVehicle = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FleetVehicle> & { id: string }) => {
      const { data, error } = await supabase
        .from("fleet_vehicles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      toast({
        title: "Vehicle Updated",
        description: "The vehicle has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update vehicle: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fleet_vehicles")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      toast({
        title: "Vehicle Deleted",
        description: "The vehicle has been removed from your fleet.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete vehicle: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return {
    vehicles,
    isLoading,
    addVehicle,
    updateVehicle,
    deleteVehicle,
  };
}
