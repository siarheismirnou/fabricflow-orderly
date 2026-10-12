import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./domain";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        id: user.id,
        email: user.email ?? "",
        name: profile?.full_name || user.email || "",
        roles: (roles ?? []).map((r) => r.role as AppRole),
      };
    },
  });
}

export function hasAny(roles: AppRole[] | undefined, allowed: AppRole[]) {
  if (!roles) return false;
  return roles.includes("super_admin") || allowed.some((r) => roles.includes(r));
}
