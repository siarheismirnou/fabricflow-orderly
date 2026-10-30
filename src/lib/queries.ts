import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLots() {
  return useQuery({
    queryKey: ["lots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_receipts")
        .select("id, product_id, supplier_id, meters, remaining_meters, received_at, received_by, note, products(sku,name,color,composition,width_cm,sale_price), suppliers(name)")
        .order("received_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("id, sku, name, composition, color, width_cm, sale_price, created_at").order("name")).data ?? [],
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

/** Cost data — super admin only (server rejects others). */
export function useReceiptCosts(enabled: boolean) {
  return useQuery({
    queryKey: ["receipt-costs"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_receipt_costs");
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.id, r]));
    },
  });
}
export function useProductCosts(enabled: boolean) {
  return useQuery({
    queryKey: ["product-costs"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_product_costs");
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.id, r]));
    },
  });
}
