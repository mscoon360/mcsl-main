import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface FuelRecord {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  refuel_date: string;
  total_cost: number;
  gallons: number;
  receipt_photo: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useFuelRecords = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: fuelRecords = [], isLoading } = useQuery({
    queryKey: ["fuel-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_records")
        .select("*")
        .order("refuel_date", { ascending: false });

      if (error) throw error;
      return data as FuelRecord[];
    },
    enabled: !!user,
  });

  const addFuelRecord = useMutation({
    mutationFn: async (record: {
      vehicle_id: string;
      total_cost: number;
      gallons: number;
      receipt_photo?: string;
      notes?: string;
    }) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("fuel_records")
        .insert({
          user_id: user.id,
          ...record,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuel-records"] });
      toast({
        title: "Refueling Recorded",
        description: "Fuel record has been saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Record Refueling",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteFuelRecord = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fuel_records")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuel-records"] });
      toast({
        title: "Record Deleted",
        description: "Fuel record has been deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Delete",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("fuel_records_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "fuel_records" }, () => {
        queryClient.invalidateQueries({ queryKey: ["fuel-records"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return {
    fuelRecords,
    isLoading,
    addFuelRecord,
    deleteFuelRecord,
  };
};
