import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Уведомления — Ткани" }, { name: "description", content: "Уведомления о смене статусов заказов" }, { property: "og:title", content: "Уведомления — Ткани" }, { property: "og:description", content: "Уведомления о смене статусов заказов" }] }),
  component: Notifications,
});

function Notifications() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const mark = useMutation({
    mutationFn: async (id?: string) => {
      const q = supabase.from("notifications").update({ is_read: true });
      await (id ? q.eq("id", id) : q.eq("is_read", false));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread"] });
    },
  });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Уведомления" subtitle="Изменения статусов заказов, касающиеся вашей роли"
        actions={<Button variant="outline" onClick={() => mark.mutate(undefined)}>Отметить все прочитанными</Button>} />
      <ul className="space-y-2">
        {data.map((n) => (
          <li key={n.id} className={`flex items-center justify-between rounded-lg border p-4 ${n.is_read ? "bg-card" : "border-primary/40 bg-primary/5"}`}>
            <div>
              <div className={n.is_read ? "" : "font-semibold"}>{n.message}</div>
              <div className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("ru-RU")}</div>
            </div>
            <div className="flex gap-2">
              {n.order_id && <Button size="sm" variant="ghost" asChild><Link to="/orders/$id" params={{ id: n.order_id }} onClick={() => mark.mutate(n.id)}>Открыть</Link></Button>}
              {!n.is_read && <Button size="sm" variant="outline" onClick={() => mark.mutate(n.id)}>Прочитано</Button>}
            </div>
          </li>
        ))}
        {data.length === 0 && <p className="text-muted-foreground">Уведомлений пока нет</p>}
      </ul>
    </div>
  );
}
