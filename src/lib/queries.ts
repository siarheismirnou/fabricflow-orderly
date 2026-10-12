import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLots() {
  return useQuery({
    queryKey: ["lots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_receipts")
        .select("*, products(sku,name,color,composition,width_cm,sale_price), suppliers(name)")
        .order("received_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("*").order("name")).data ?? [],
  });
}
export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [],
  });
}
export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("name")).data ?? [],
  });
}
export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("full_name")).data ?? [],
  });
}
export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, clients(name), order_items(meters, price, product_id, source, products(sku,name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
