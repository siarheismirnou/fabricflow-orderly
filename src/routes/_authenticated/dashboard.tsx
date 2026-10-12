import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { useLots, useOrders, useProfiles } from "@/lib/queries";
import { byManager, salesTimeline, soldOrders, topProducts, type Period, type ReportOrder } from "@/lib/reports";
import { meters, rub } from "@/lib/domain";
import { PageHeader } from "@/components/PageHeader";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Отчёты — Ткани" }, { name: "description", content: "Продажи и остатки: графики и таблицы" }, { property: "og:title", content: "Отчёты — Ткани" }, { property: "og:description", content: "Продажи и остатки: графики и таблицы" }] }),
  component: Dashboard,
});

const salesCfg = { revenue: { label: "Выручка", color: "var(--chart-1)" }, meters: { label: "Метры", color: "var(--chart-2)" } } satisfies ChartConfig;
const stockCfg = { left: { label: "Остаток, м", color: "var(--chart-1)" } } satisfies ChartConfig;
const topCfg = { meters: { label: "Продано, м", color: "var(--chart-2)" } } satisfies ChartConfig;

function Dashboard() {
  const { data: orders = [] } = useOrders();
  const { data: lots = [] } = useLots();
  const { data: profiles = [] } = useProfiles();
  const [period, setPeriod] = useState<Period>("month");
  const [manager, setManager] = useState<string>("all");
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? "—";

  const sold = useMemo(() => soldOrders(orders as unknown as ReportOrder[], period, manager), [orders, period, manager]);
  const timeline = useMemo(() => salesTimeline(sold, period), [sold, period]);
  const top = useMemo(() => topProducts(sold), [sold]);
  const managers = useMemo(() => byManager(soldOrders(orders as unknown as ReportOrder[], period, "all")), [orders, period]);
  const stock = useMemo(() => {
    const m = new Map<string, { name: string; left: number; value: number }>();
    for (const l of lots) {
      const c = m.get(l.product_id) ?? { name: `${l.products?.sku} ${l.products?.name}`, left: 0, value: 0 };
      c.left += Number(l.remaining_meters);
      c.value += Number(l.remaining_meters) * Number(l.purchase_price);
      m.set(l.product_id, c);
    }
    return [...m.values()].sort((a, b) => b.left - a.left);
  }, [lots]);

  const revenue = sold.reduce((s, o) => s + Number(o.total), 0);
  const soldM = sold.reduce((s, o) => s + o.order_items.reduce((a, i) => a + Number(i.meters), 0), 0);
  const stockM = stock.reduce((s, x) => s + x.left, 0);
  const stockV = stock.reduce((s, x) => s + x.value, 0);
  const managerIds = [...new Set(orders.map((o) => o.manager_id))];

  return (
    <div>
      <PageHeader
        title="Отчёты"
        subtitle="Продажи считаются по оплаченным заказам (Оплачен и далее)"
        actions={<>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList><TabsTrigger value="week">Неделя</TabsTrigger><TabsTrigger value="month">Месяц</TabsTrigger><TabsTrigger value="year">Год</TabsTrigger></TabsList>
          </Tabs>
          <Select value={manager} onValueChange={setManager}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Вся организация</SelectItem>
              {managerIds.map((id) => <SelectItem key={id} value={id}>{nameOf(id)}</SelectItem>)}
            </SelectContent>
          </Select>
        </>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Выручка" value={rub(revenue)} />
        <Kpi label="Продано" value={meters(soldM)} />
        <Kpi label="Оплаченных заказов" value={String(sold.length)} />
        <Kpi label="Остаток на складе" value={meters(stockM)} hint={`на ${rub(stockV)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Динамика продаж">
          <ChartContainer config={salesCfg} className="h-64 w-full">
            <LineChart data={timeline}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={60} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </Card>
        <Card title="Топ проданных тканей, м">
          <ChartContainer config={topCfg} className="h-64 w-full">
            <BarChart data={top} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={140} fontSize={11} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="meters" fill="var(--color-meters)" radius={4} />
            </BarChart>
          </ChartContainer>
        </Card>
        <Card title="Остатки по тканям, м">
          <ChartContainer config={stockCfg} className="h-64 w-full">
            <BarChart data={stock}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="left" fill="var(--color-left)" radius={4} />
            </BarChart>
          </ChartContainer>
        </Card>
        <Card title="Продажи по специалистам">
          <Table>
            <TableHeader><TableRow><TableHead>Менеджер</TableHead><TableHead className="text-right">Заказов</TableHead><TableHead className="text-right">Метров</TableHead><TableHead className="text-right">Выручка</TableHead></TableRow></TableHeader>
            <TableBody>
              {managers.map((m) => (
                <TableRow key={m.manager_id}><TableCell>{nameOf(m.manager_id)}</TableCell><TableCell className="text-right">{m.orders}</TableCell><TableCell className="text-right">{meters(m.meters)}</TableCell><TableCell className="text-right font-semibold">{rub(m.revenue)}</TableCell></TableRow>
              ))}
              {managers.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Нет оплаченных заказов за период</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Card title="Проданные товары за период" className="mt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Ткань</TableHead><TableHead className="text-right">Метров</TableHead><TableHead className="text-right">Выручка</TableHead></TableRow></TableHeader>
          <TableBody>
            {topProducts(sold, 100).map((t) => <TableRow key={t.name}><TableCell>{t.name}</TableCell><TableCell className="text-right">{meters(t.meters)}</TableCell><TableCell className="text-right">{rub(t.revenue)}</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border bg-card p-5 ${className}`}>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
