import { SOLD_STATUSES, type OrderStatus } from "./domain";

export type Period = "week" | "month" | "year";

export type ReportOrder = {
  created_at: string;
  status: OrderStatus;
  manager_id: string;
  total: number;
  order_items: { meters: number; price: number; product_id: string; products: { sku: string; name: string } | null }[];
};

export function periodStart(p: Period, now = new Date()): Date {
  const d = new Date(now);
  if (p === "week") d.setDate(d.getDate() - 7);
  else if (p === "month") d.setMonth(d.getMonth() - 1);
  else d.setFullYear(d.getFullYear() - 1);
  return d;
}

/** Orders counted as sold within the period, optionally for one manager. */
export function soldOrders(orders: ReportOrder[], p: Period, managerId: string | "all", now = new Date()) {
  const from = periodStart(p, now).getTime();
  return orders.filter(
    (o) =>
      SOLD_STATUSES.includes(o.status) &&
      new Date(o.created_at).getTime() >= from &&
      new Date(o.created_at).getTime() <= now.getTime() &&
      (managerId === "all" || o.manager_id === managerId),
  );
}

function bucketKey(d: Date, p: Period) {
  if (p === "year") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function salesTimeline(orders: ReportOrder[], p: Period, now = new Date()) {
  const buckets = new Map<string, { label: string; revenue: number; meters: number }>();
  const start = periodStart(p, now);
  const cur = new Date(start);
  while (cur <= now) {
    const k = bucketKey(cur, p);
    if (!buckets.has(k)) buckets.set(k, { label: k, revenue: 0, meters: 0 });
    if (p === "year") cur.setMonth(cur.getMonth() + 1);
    else cur.setDate(cur.getDate() + 1);
  }
  for (const o of orders) {
    const b = buckets.get(bucketKey(new Date(o.created_at), p));
    if (!b) continue;
    b.revenue += Number(o.total);
    b.meters += o.order_items.reduce((s, i) => s + Number(i.meters), 0);
  }
  return [...buckets.values()];
}

export function topProducts(orders: ReportOrder[], limit = 8) {
  const m = new Map<string, { name: string; meters: number; revenue: number }>();
  for (const o of orders)
    for (const i of o.order_items) {
      const cur = m.get(i.product_id) ?? { name: `${i.products?.sku ?? ""} ${i.products?.name ?? ""}`.trim(), meters: 0, revenue: 0 };
      cur.meters += Number(i.meters);
      cur.revenue += Number(i.meters) * Number(i.price);
      m.set(i.product_id, cur);
    }
  return [...m.values()].sort((a, b) => b.meters - a.meters).slice(0, limit);
}

export function byManager(orders: ReportOrder[]) {
  const m = new Map<string, { manager_id: string; orders: number; revenue: number; meters: number }>();
  for (const o of orders) {
    const cur = m.get(o.manager_id) ?? { manager_id: o.manager_id, orders: 0, revenue: 0, meters: 0 };
    cur.orders += 1;
    cur.revenue += Number(o.total);
    cur.meters += o.order_items.reduce((s, i) => s + Number(i.meters), 0);
    m.set(o.manager_id, cur);
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue);
}
