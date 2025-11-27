import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  department: string;
}

export function useUsers(department?: string) {
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["users", department],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, username, name, department");

      if (error) throw error;

      // Filter by department if provided
      if (department) {
        return profiles?.filter(
          (profile) => profile.department.toLowerCase().includes(department.toLowerCase())
        ) as User[] || [];
      }

      return (profiles as User[]) || [];
    },
  });

  return {
    users,
    isLoading,
    error,
  };
}
