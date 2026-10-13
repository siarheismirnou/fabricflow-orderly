import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { useProfiles } from "@/lib/queries";
import { STATUS_FLOW, STATUS_LABELS, canMoveTo, meters, nextStatus, rub, type OrderStatus } from "@/lib/domain";
import { PageHeader } from "@/components/PageHeader";
import { OrderDocuments } from "@/components/OrderDocuments";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  head: () => ({ meta: [{ title: "Заказ — Ткани" }, { name: "description", content: "Карточка заказа" }, { property: "og:title", content: "Заказ — Ткани" }, { property: "og:description", content: "Карточка заказа" }] }),
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: profiles = [] } = useProfiles();
  const nameOf = (uid: string | null) => profiles.find((p) => p.id === uid)?.full_name ?? "—";
  const { data: order } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, clients(*), order_items(*, products(sku,name,color), suppliers(name)), order_status_history(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const move = useMutation({
    mutationFn: async (to: OrderStatus) => {
      const { error } = await supabase.from("orders").update({ status: to }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Статус обновлён, ответственные уведомлены");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!order) return <p className="text-muted-foreground">Загрузка…</p>;
  const idx = STATUS_FLOW.indexOf(order.status);
  const next = nextStatus(order.status);
  const prev = idx > 0 ? STATUS_FLOW[idx - 1] : null;
  const roles = me?.roles ?? [];
  const history = [...order.order_status_history].sort((a, b) => a.changed_at.localeCompare(b.changed_at));

  return (
    <div className="max-w-5xl">
      <Link to="/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Все заказы</Link>
      <PageHeader
        title={`Заказ №${order.number}`}
        subtitle={`${order.clients?.name} · менеджер ${nameOf(order.manager_id)} · ${new Date(order.created_at).toLocaleString("ru-RU")}`}
        actions={<>
          {prev && canMoveTo(roles, prev) && <Button variant="outline" disabled={move.isPending} onClick={() => move.mutate(prev)}>Вернуть в «{STATUS_LABELS[prev]}»</Button>}
          {next && (canMoveTo(roles, next)
            ? <Button disabled={move.isPending} onClick={() => move.mutate(next)}>Перевести в «{STATUS_LABELS[next]}»</Button>
            : <span className="self-center text-xs text-muted-foreground">Следующий шаг выполняет другой отдел</span>)}
        </>}
      />

      <ol className="mb-8 grid grid-cols-7 gap-1">
        {STATUS_FLOW.map((s, i) => (
          <li key={s} className="text-center">
            <div className={`mb-2 h-1.5 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />
            <div className={`flex items-center justify-center gap-1 text-xs ${i === idx ? "font-semibold text-primary" : i < idx ? "text-foreground" : "text-muted-foreground"}`}>
              {i < idx && <Check className="h-3 w-3" />}{STATUS_LABELS[s]}
            </div>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Ткань</TableHead><TableHead>Источник</TableHead><TableHead className="text-right">Метров</TableHead><TableHead className="text-right">Цена</TableHead><TableHead className="text-right">Сумма</TableHead></TableRow></TableHeader>
            <TableBody>
              {order.order_items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell><div className="font-semibold">{it.products?.sku} {it.products?.name}</div><div className="text-xs text-muted-foreground">{it.products?.color}</div></TableCell>
                  <TableCell>{it.source === "stock" ? "Склад" : `Под заказ · ${it.suppliers?.name ?? ""}`}</TableCell>
                  <TableCell className="text-right">{meters(Number(it.meters))}</TableCell>
                  <TableCell className="text-right">{rub(Number(it.price))}</TableCell>
                  <TableCell className="text-right font-semibold">{rub(Number(it.meters) * Number(it.price))}</TableCell>
                </TableRow>
              ))}
              <TableRow><TableCell colSpan={4} className="text-right font-semibold">Итого</TableCell><TableCell className="text-right text-lg font-semibold">{rub(Number(order.total))}</TableCell></TableRow>
            </TableBody>
          </Table>
          {order.note && <p className="border-t p-4 text-sm"><span className="text-muted-foreground">Комментарий:</span> {order.note}</p>}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-semibold">История статусов</h3>
          <ul className="space-y-3 text-sm">
            {history.map((h) => (
              <li key={h.id} className="border-l-2 border-primary pl-3">
                <div className="font-semibold">{STATUS_LABELS[h.to_status]}</div>
                <div className="text-xs text-muted-foreground">{new Date(h.changed_at).toLocaleString("ru-RU")} · {nameOf(h.changed_by)}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <OrderDocuments orderId={id} status={order.status} roles={roles} userId={me?.id} />
    </div>
  );
}
