import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClients, useLots, useProducts, useSuppliers } from "@/lib/queries";
import { meters, rub } from "@/lib/domain";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/orders/new")({
  head: () => ({ meta: [{ title: "Новый заказ — Ткани" }, { name: "description", content: "Оформление заказа клиента" }, { property: "og:title", content: "Новый заказ — Ткани" }, { property: "og:description", content: "Оформление заказа клиента" }] }),
  component: NewOrder,
});

type Line = {
  key: string;
  source: "stock" | "supplier";
  product_id: string;
  label: string;
  receipt_id?: string;
  supplier_id?: string;
  supplierName?: string;
  available?: number;
  meters: number;
  price: number;
};

function NewOrder() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: clients = [] } = useClients();
  const { data: lots = [] } = useLots();
  const { data: products = [] } = useProducts();
  const { data: suppliers = [] } = useSuppliers();
  const [clientId, setClientId] = useState("");
  const [clientQ, setClientQ] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState({ product_id: "", supplier_id: "", meters: "", price: "" });

  const reserved = (receiptId: string) => lines.filter((l) => l.receipt_id === receiptId).reduce((s, l) => s + l.meters, 0);
  const found = lots.filter((l) => Number(l.remaining_meters) > 0 && `${l.products?.sku} ${l.products?.name} ${l.products?.color}`.toLowerCase().includes(q.toLowerCase()));
  const total = lines.reduce((s, l) => s + l.meters * l.price, 0);

  const save = useMutation({
    mutationFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      const { data: order, error } = await supabase
        .from("orders")
        .insert({ client_id: clientId, note: note || null, manager_id: me.user!.id })
        .select("id")
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("order_items").insert(
        lines.map((l) => ({
          order_id: order.id, source: l.source, product_id: l.product_id,
          receipt_id: l.receipt_id ?? null, supplier_id: l.supplier_id ?? null, meters: l.meters, price: l.price,
        })),
      );
      if (e2) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw e2;
      }
      return order.id;
    },
    onSuccess: (id) => {
      toast.success("Заказ создан");
      qc.invalidateQueries();
      navigate({ to: "/orders/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-6xl">
      <PageHeader title="Новый заказ" subtitle="Выберите клиента и добавьте ткани со склада или под заказ" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 text-lg font-semibold">1. Клиент</h2>
            <Input placeholder="Поиск по названию или ИНН…" value={clientQ} onChange={(e) => setClientQ(e.target.value)} className="mb-3" />
            <div className="grid max-h-48 gap-2 overflow-auto sm:grid-cols-2">
              {clients.filter((c) => `${c.name} ${c.inn ?? ""}`.toLowerCase().includes(clientQ.toLowerCase())).map((c) => (
                <button key={c.id} type="button" onClick={() => setClientId(c.id)}
                  className={`rounded-md border p-3 text-left text-sm transition-colors ${clientId === c.id ? "border-primary bg-primary/10" : "hover:bg-muted"}`}>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.inn ? `ИНН ${c.inn}` : c.phone}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 text-lg font-semibold">2. Товары</h2>
            <Tabs defaultValue="stock">
              <TabsList><TabsTrigger value="stock">Со склада</TabsTrigger><TabsTrigger value="supplier">Под заказ</TabsTrigger></TabsList>
              <TabsContent value="stock">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Поиск по складу: артикул, название, цвет…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="max-h-80 space-y-2 overflow-auto">
                  {found.map((l) => <StockRow key={l.id} lot={l} free={Number(l.remaining_meters) - reserved(l.id)} onAdd={(m, price) =>
                    setLines([...lines, { key: crypto.randomUUID(), source: "stock", product_id: l.product_id, receipt_id: l.id, label: `${l.products?.sku} ${l.products?.name}`, available: Number(l.remaining_meters), meters: m, price }])} />)}
                  {found.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Ничего не найдено на складе</p>}
                </div>
              </TabsContent>
              <TabsContent value="supplier">
                <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
                  e.preventDefault();
                  const p = products.find((x) => x.id === custom.product_id);
                  const s = suppliers.find((x) => x.id === custom.supplier_id);
                  if (!p || !s) return toast.error("Выберите товар и поставщика");
                  setLines([...lines, { key: crypto.randomUUID(), source: "supplier", product_id: p.id, supplier_id: s.id, supplierName: s.name, label: `${p.sku} ${p.name}`, meters: Number(custom.meters), price: Number(custom.price || p.sale_price) }]);
                  setCustom({ product_id: "", supplier_id: "", meters: "", price: "" });
                }}>
                  <div className="space-y-1.5"><Label>Товар</Label>
                    <Select value={custom.product_id} onValueChange={(v) => setCustom({ ...custom, product_id: v, price: String(products.find((p) => p.id === v)?.sale_price ?? "") })}>
                      <SelectTrigger><SelectValue placeholder="Ткань из номенклатуры" /></SelectTrigger>
                      <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Поставщик</Label>
                    <Select value={custom.supplier_id} onValueChange={(v) => setCustom({ ...custom, supplier_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Из справочника" /></SelectTrigger>
                      <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Метров</Label><Input type="number" step="0.01" min="0.01" required value={custom.meters} onChange={(e) => setCustom({ ...custom, meters: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Цена за м, ₽</Label><Input type="number" step="0.01" required value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value })} /></div>
                  <Button className="sm:col-span-2" variant="secondary">Добавить в заказ</Button>
                </form>
              </TabsContent>
            </Tabs>
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-lg border bg-card p-5 lg:sticky lg:top-8">
          <h2 className="text-lg font-semibold">Состав заказа</h2>
          {lines.length === 0 && <p className="text-sm text-muted-foreground">Добавьте хотя бы одну позицию</p>}
          {lines.map((l) => (
            <div key={l.key} className="flex items-start justify-between gap-2 border-b pb-2 text-sm">
              <div>
                <div className="font-semibold">{l.label}</div>
                <div className="text-xs text-muted-foreground">{l.source === "stock" ? "Со склада" : `Под заказ · ${l.supplierName}`} · {meters(l.meters)} × {rub(l.price)}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((x) => x.key !== l.key))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <div className="flex justify-between text-lg font-semibold"><span>Итого</span><span>{rub(total)}</span></div>
          <Textarea placeholder="Комментарий к заказу" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button className="w-full" disabled={!clientId || lines.length === 0 || save.isPending} onClick={() => save.mutate()}>Создать заказ</Button>
          {!clientId && <p className="text-xs text-muted-foreground">Выберите клиента</p>}
        </aside>
      </div>
    </div>
  );
}

function StockRow({ lot, free, onAdd }: { lot: { id: string; remaining_meters: number; purchase_price: number; products: { sku: string; name: string; color: string | null; sale_price: number } | null; suppliers: { name: string } | null }; free: number; onAdd: (m: number, price: number) => void }) {
  const [m, setM] = useState("");
  return (
    <div className="flex items-center gap-3 rounded-md border p-3 text-sm">
      <div className="flex-1">
        <div className="font-semibold">{lot.products?.sku} · {lot.products?.name} <span className="font-normal text-muted-foreground">{lot.products?.color}</span></div>
        <div className="text-xs text-muted-foreground">Доступно {meters(free)} · {rub(Number(lot.products?.sale_price))}/м · {lot.suppliers?.name}</div>
      </div>
      <Input className="w-24" type="number" step="0.01" placeholder="м" value={m} onChange={(e) => setM(e.target.value)} />
      <Button size="sm" disabled={!m || Number(m) <= 0 || Number(m) > free} onClick={() => { onAdd(Number(m), Number(lot.products?.sale_price)); setM(""); }}>Добавить</Button>
    </div>
  );
}
