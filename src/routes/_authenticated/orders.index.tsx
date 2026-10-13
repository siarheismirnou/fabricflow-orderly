import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, LayoutList, Columns3 } from "lucide-react";
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

type OrderRow = ReturnType<typeof useOrders>["data"] extends (infer T)[] | undefined ? T : never;

function Orders() {
  const { data: me } = useMe();
  const { data: orders = [] } = useOrders();
  const { data: profiles = [] } = useProfiles();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [view, setView] = useState<"table" | "kanban">("table");
  const rows = orders.filter((o) => filter === "all" || o.status === filter);
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? "—";

  return (
    <div>
      <PageHeader
        title="Заказы"
        subtitle={`${orders.length} заказов в системе`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border">
              <Button size="sm" variant={view === "table" ? "default" : "ghost"} className="rounded-r-none" onClick={() => setView("table")}>
                <LayoutList className="mr-1 h-4 w-4" /> Таблица
              </Button>
              <Button size="sm" variant={view === "kanban" ? "default" : "ghost"} className="rounded-l-none" onClick={() => setView("kanban")}>
                <Columns3 className="mr-1 h-4 w-4" /> Канбан
              </Button>
            </div>
            {hasAny(me?.roles, ["sales_manager"]) && (
              <Button asChild><Link to="/orders/new"><Plus className="mr-1 h-4 w-4" /> Новый заказ</Link></Button>
            )}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", ...STATUS_FLOW] as const).map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s === "all" ? "Все" : STATUS_LABELS[s]} ({s === "all" ? orders.length : orders.filter((o) => o.status === s).length})
          </Button>
        ))}
      </div>
      {view === "table" ? (
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
      ) : (
        <KanbanBoard orders={rows} nameOf={nameOf} />
      )}
    </div>
  );
}

function KanbanBoard({ orders, nameOf }: { orders: OrderRow[]; nameOf: (id: string) => string }) {
  const columns = STATUS_FLOW.map((s) => ({ status: s, items: orders.filter((o) => o.status === s) }));
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map(({ status, items }) => (
        <div key={status} className="flex w-64 shrink-0 flex-col rounded-lg border bg-muted/40">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <StatusBadge label={STATUS_LABELS[status]} tone={statusTone(status)} />
            <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-muted-foreground">{items.length}</span>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-2">
            {items.map((o) => (
              <Link key={o.id} to="/orders/$id" params={{ id: o.id }} className="rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary">№{o.number}</span>
                  <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("ru-RU")}</span>
                </div>
                <div className="mt-1 text-sm font-medium">{o.clients?.name}</div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{nameOf(o.manager_id)}</span>
                  <span className="font-semibold text-foreground">{rub(Number(o.total))}</span>
                </div>
              </Link>
            ))}
            {items.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">Нет заказов</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
