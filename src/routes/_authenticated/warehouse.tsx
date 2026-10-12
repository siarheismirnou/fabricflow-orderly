import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PackagePlus, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hasAny, useMe } from "@/lib/auth";
import { meters, rub } from "@/lib/domain";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/warehouse")({
  head: () => ({ meta: [{ title: "Склад — Ткани" }, { name: "description", content: "Остатки, приход и номенклатура тканей" }, { property: "og:title", content: "Склад — Ткани" }, { property: "og:description", content: "Остатки, приход и номенклатура тканей" }] }),
  component: Warehouse,
});

export function useLots() {
  return useQuery({
    queryKey: ["lots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_receipts")
        .select("*, products(sku,name,color,composition,width_cm,sale_price), suppliers(name)")
        .order("received_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("*").order("name")).data ?? [],
  });
}
export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [],
  });
}

function Warehouse() {
  const { data: me } = useMe();
  const canEdit = hasAny(me?.roles, ["warehouse"]);
  const { data: lots = [] } = useLots();
  const { data: products = [] } = useProducts();
  const [q, setQ] = useState("");
  const [onlyLeft, setOnlyLeft] = useState(true);

  const filtered = lots.filter((l) => {
    const s = `${l.products?.sku} ${l.products?.name} ${l.products?.color} ${l.suppliers?.name}`.toLowerCase();
    return s.includes(q.toLowerCase()) && (!onlyLeft || Number(l.remaining_meters) > 0);
  });

  const totals = useMemo(() => {
    const byProduct = new Map<string, { sku: string; name: string; left: number; value: number }>();
    for (const l of lots) {
      const k = l.product_id;
      const cur = byProduct.get(k) ?? { sku: l.products?.sku ?? "", name: l.products?.name ?? "", left: 0, value: 0 };
      cur.left += Number(l.remaining_meters);
      cur.value += Number(l.remaining_meters) * Number(l.purchase_price);
      byProduct.set(k, cur);
    }
    return [...byProduct.values()].sort((a, b) => b.left - a.left);
  }, [lots]);
  const totalLeft = totals.reduce((s, t) => s + t.left, 0);
  const totalValue = totals.reduce((s, t) => s + t.value, 0);

  return (
    <div>
      <PageHeader
        title="Склад"
        subtitle={`Всего на складе ${meters(totalLeft)} на сумму ${rub(totalValue)} (по цене прихода)`}
        actions={canEdit && (<><ProductDialog /><ReceiptDialog products={products} /></>)}
      />
      <Tabs defaultValue="lots">
        <TabsList>
          <TabsTrigger value="lots">Партии</TabsTrigger>
          <TabsTrigger value="totals">Остатки по товарам</TabsTrigger>
          <TabsTrigger value="catalog">Номенклатура</TabsTrigger>
        </TabsList>
        <TabsContent value="lots">
          <div className="mb-4 flex items-center gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Артикул, название, цвет, поставщик…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyLeft} onChange={(e) => setOnlyLeft(e.target.checked)} /> только с остатком
            </label>
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата прихода</TableHead><TableHead>Артикул</TableHead><TableHead>Ткань</TableHead><TableHead>Поставщик</TableHead>
                  <TableHead className="text-right">Пришло</TableHead><TableHead className="text-right">Осталось</TableHead>
                  <TableHead className="text-right">Цена прихода, м</TableHead><TableHead className="text-right">Цена продажи, м</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{new Date(l.received_at).toLocaleDateString("ru-RU")}</TableCell>
                    <TableCell className="font-mono text-xs">{l.products?.sku}</TableCell>
                    <TableCell><div className="font-semibold">{l.products?.name}</div><div className="text-xs text-muted-foreground">{l.products?.color} · {l.products?.composition}</div></TableCell>
                    <TableCell>{l.suppliers?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">{meters(Number(l.meters))}</TableCell>
                    <TableCell className="text-right font-semibold">{meters(Number(l.remaining_meters))}</TableCell>
                    <TableCell className="text-right">{rub(Number(l.purchase_price))}</TableCell>
                    <TableCell className="text-right">{rub(Number(l.products?.sale_price))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="totals">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Артикул</TableHead><TableHead>Ткань</TableHead><TableHead className="text-right">Остаток</TableHead><TableHead className="text-right">Стоимость остатка</TableHead></TableRow></TableHeader>
              <TableBody>
                {totals.map((t) => (
                  <TableRow key={t.sku}><TableCell className="font-mono text-xs">{t.sku}</TableCell><TableCell>{t.name}</TableCell><TableCell className="text-right font-semibold">{meters(t.left)}</TableCell><TableCell className="text-right">{rub(t.value)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="catalog">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Артикул</TableHead><TableHead>Название</TableHead><TableHead>Состав</TableHead><TableHead>Цвет</TableHead><TableHead>Ширина</TableHead><TableHead className="text-right">Цена продажи, м</TableHead></TableRow></TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}><TableCell className="font-mono text-xs">{p.sku}</TableCell><TableCell className="font-semibold">{p.name}</TableCell><TableCell>{p.composition}</TableCell><TableCell>{p.color}</TableCell><TableCell>{p.width_cm ? `${p.width_cm} см` : "—"}</TableCell><TableCell className="text-right">{rub(Number(p.sale_price))}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReceiptDialog({ products }: { products: { id: string; sku: string; name: string }[] }) {
  const qc = useQueryClient();
  const { data: suppliers = [] } = useSuppliers();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ product_id: "", supplier_id: "", meters: "", purchase_price: "", note: "" });
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stock_receipts").insert({
        product_id: f.product_id,
        supplier_id: f.supplier_id || null,
        meters: Number(f.meters),
        remaining_meters: Number(f.meters),
        purchase_price: Number(f.purchase_price),
        note: f.note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Приход оформлен");
      setOpen(false);
      setF({ product_id: "", supplier_id: "", meters: "", purchase_price: "", note: "" });
      qc.invalidateQueries({ queryKey: ["lots"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><PackagePlus className="mr-1 h-4 w-4" /> Оформить приход</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Приход товара на склад</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!f.product_id) return toast.error("Выберите товар"); m.mutate(); }}>
          <div className="space-y-1.5"><Label>Товар</Label>
            <Select value={f.product_id} onValueChange={(v) => setF({ ...f, product_id: v })}>
              <SelectTrigger><SelectValue placeholder="Выберите ткань" /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Поставщик</Label>
            <Select value={f.supplier_id} onValueChange={(v) => setF({ ...f, supplier_id: v })}>
              <SelectTrigger><SelectValue placeholder="Выберите поставщика" /></SelectTrigger>
              <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Метров</Label><Input type="number" step="0.01" min="0.01" required value={f.meters} onChange={(e) => setF({ ...f, meters: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Цена прихода за м, ₽</Label><Input type="number" step="0.01" min="0" required value={f.purchase_price} onChange={(e) => setF({ ...f, purchase_price: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Комментарий</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          <Button className="w-full" disabled={m.isPending}>Принять на склад</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ sku: "", name: "", composition: "", color: "", width_cm: "", sale_price: "" });
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").insert({
        sku: f.sku, name: f.name, composition: f.composition || null, color: f.color || null,
        width_cm: f.width_cm ? Number(f.width_cm) : null, sale_price: Number(f.sale_price || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Товар добавлен"); setOpen(false); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="mr-1 h-4 w-4" /> Новый товар</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Новая позиция номенклатуры</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="space-y-1.5"><Label>Артикул</Label><Input required value={f.sku} onChange={set("sku")} /></div>
          <div className="space-y-1.5"><Label>Название</Label><Input required value={f.name} onChange={set("name")} /></div>
          <div className="space-y-1.5"><Label>Состав</Label><Input value={f.composition} onChange={set("composition")} /></div>
          <div className="space-y-1.5"><Label>Цвет</Label><Input value={f.color} onChange={set("color")} /></div>
          <div className="space-y-1.5"><Label>Ширина, см</Label><Input type="number" value={f.width_cm} onChange={set("width_cm")} /></div>
          <div className="space-y-1.5"><Label>Цена продажи за м, ₽</Label><Input type="number" required value={f.sale_price} onChange={set("sale_price")} /></div>
          <Button className="col-span-2" disabled={m.isPending}>Сохранить</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
