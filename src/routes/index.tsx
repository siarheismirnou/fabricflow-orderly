import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/dashboard" : "/auth" });
  },
  head: () => ({
    meta: [
      { title: "Ткани — внутренняя система" },
      { name: "description", content: "Внутренняя система учёта заказов, склада тканей и продаж" },
      { property: "og:title", content: "Ткани — внутренняя система" },
      { property: "og:description", content: "Внутренняя система учёта заказов, склада тканей и продаж" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => null,
});
