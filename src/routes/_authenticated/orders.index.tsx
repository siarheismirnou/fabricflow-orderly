import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useMe, hasAny } from "@/lib/auth";
import { useOrders, useProfiles } from "@/lib/queries";
import { STATUS_FLOW, STATUS_LABELS, rub, type OrderStatus } from "@/lib/domain";
import { PageHeader, StatusBadge } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({ meta: [{ title: "Заказы — Ткани" }, { name: "description", content: "Список заказов клиентов" }, { property: "og:title", content: "Заказы — Ткани" }, { property: "og:description", content: "Список заказов клиентов" }] }),
  component: Orders,
});

export function statusTone(s: OrderStatus) {
  return s === "completed" ? "success" : s === "awaiting_payment" ? "accent" : s === "new" ? "muted" : "default";
}

function Orders() {
  const { data: me } = useMe();
  const { data: orders = [] } = useOrders();
  const { data: profiles = [] } = useProfiles();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const rows = orders.filter((o) => filter === "all" || o.status === filter);
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? "—";

  return (
    <div>
      <PageHeader
        title="Заказы"
        subtitle={`${orders.length} заказов в системе`}
        actions={hasAny(me?.roles, ["sales_manager"]) && (
          <Button asChild><Link to="/orders/new"><Plus className="mr-1 h-4 w-4" /> Новый заказ</Link></Button>
        )}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", ...STATUS_FLOW] as const).map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s === "all" ? "Все" : STATUS_LABELS[s]} ({s === "all" ? orders.length : orders.filter((o) => o.status === s).length})
          </Button>
        ))}
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>№</TableHead><TableHead>Дата</TableHead><TableHead>Клиент</TableHead><TableHead>Менеджер</TableHead><TableHead>Позиций</TableHead><TableHead>Статус</TableHead><TableHead className="text-right">Сумма</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((o) => (
              <TableRow key={o.id} className="cursor-pointer">
                <TableCell><Link to="/orders/$id" params={{ id: o.id }} className="font-semibold text-primary underline-offset-4 hover:underline">№{o.number}</Link></TableCell>
                <TableCell>{new Date(o.created_at).toLocaleDateString("ru-RU")}</TableCell>
                <TableCell>{o.clients?.name}</TableCell>
                <TableCell>{nameOf(o.manager_id)}</TableCell>
                <TableCell>{o.order_items.length}</TableCell>
                <TableCell><StatusBadge label={STATUS_LABELS[o.status]} tone={statusTone(o.status)} /></TableCell>
                <TableCell className="text-right font-semibold">{rub(Number(o.total))}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Заказов нет</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
