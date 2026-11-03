import { t } from "@/lib/i18n";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/orders" : "/auth" });
  },
  head: () => ({
    meta: [
      { title: t("Ткани — внутренняя система") },
      { name: "description", content: t("Внутренняя система учёта заказов, склада тканей и продаж") },
      { property: "og:title", content: t("Ткани — внутренняя система") },
      { property: "og:description", content: t("Внутренняя система учёта заказов, склада тканей и продаж") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => null,
});
