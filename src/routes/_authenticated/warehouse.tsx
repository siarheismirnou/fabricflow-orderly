import { t } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PackagePlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hasAny, useMe } from "@/lib/auth";
import { meters, rub } from "@/lib/domain";
import { useLots, useProductCosts, useProducts, useReceiptCosts, useSuppliers } from "@/lib/queries";
import { marginFromSale, saleFromMargin } from "@/lib/pricing";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/warehouse")({
  head: () => ({ meta: [{ title: t("Склад — Ткани") }, { name: "description", content: t("Остатки, приход и номенклатура тканей") }, { property: "og:title", content: t("Склад — Ткани") }, { property: "og:description", content: t("Остатки, приход и номенклатура тканей") }] }),
  component: Warehouse,
});

function Warehouse() {
  const { data: me } = useMe();
  const canEdit = hasAny(me?.roles, ["warehouse"]);
  const isAdmin = !!me?.roles.includes("super_admin");
  const { data: rc } = useReceiptCosts(isAdmin);
  const { data: pc } = useProductCosts(isAdmin);
  const lotCost = (id: string) => Number(rc?.get(id)?.purchase_price ?? 0);
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
      cur.value += Number(l.remaining_meters) * lotCost(l.id);
      byProduct.set(k, cur);
    }
    return [...byProduct.values()].sort((a, b) => b.left - a.left);
  }, [lots, rc]);
  const totalLeft = totals.reduce((s, t) => s + t.left, 0);
  const totalValue = totals.reduce((s, t) => s + t.value, 0);

  return (
    <div>
      <PageHeader
        title={t("Склад")}
        subtitle={isAdmin ? `Всего на складе ${meters(totalLeft)} на сумму ${rub(totalValue)} (по себестоимости)` : `Всего на складе ${meters(totalLeft)}`}
        actions={canEdit && (<><ProductDialog isAdmin={isAdmin} /><ReceiptDialog products={products} isAdmin={isAdmin} /></>)}
      />
      <Tabs defaultValue="lots">
        <TabsList>
          <TabsTrigger value="lots">{t("Партии")}</TabsTrigger>
          <TabsTrigger value="totals">{t("Остатки по товарам")}</TabsTrigger>
          <TabsTrigger value="catalog">{t("Номенклатура")}</TabsTrigger>
        </TabsList>
        <TabsContent value="lots">
          <div className="mb-4 flex items-center gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder={t("Артикул, название, цвет, поставщик…")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyLeft} onChange={(e) => setOnlyLeft(e.target.checked)} /> {t("только с остатком")}
            </label>
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Дата прихода")}</TableHead><TableHead>{t("Артикул")}</TableHead><TableHead>{t("Ткань")}</TableHead><TableHead>{t("Поставщик")}</TableHead>
                  <TableHead className="text-right">{t("Пришло")}</TableHead><TableHead className="text-right">{t("Осталось")}</TableHead>
                  {isAdmin && <TableHead className="text-right">{t("Себестоимость, м")}</TableHead>}<TableHead className="text-right">{t("Цена продажи, м")}</TableHead>
                  {isAdmin && <TableHead />}
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
                    {isAdmin && <TableCell className="text-right">{rub(lotCost(l.id))}</TableCell>}
                    <TableCell className="text-right">{rub(Number(l.products?.sale_price))}</TableCell>
                    {isAdmin && <TableCell className="w-10"><EditRowDialog title={t("Редактировать партию")} table="stock_receipts" row={{ ...l, purchase_price: lotCost(l.id) }} fields={LOT_FIELDS} invalidate={["lots", "receipt-costs"]} /></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="totals">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>{t("Артикул")}</TableHead><TableHead>{t("Ткань")}</TableHead><TableHead className="text-right">{t("Остаток")}</TableHead>{isAdmin && <TableHead className="text-right">{t("Стоимость остатка")}</TableHead>}</TableRow></TableHeader>
              <TableBody>
                {totals.map((t) => (
                  <TableRow key={t.sku}><TableCell className="font-mono text-xs">{t.sku}</TableCell><TableCell>{t.name}</TableCell><TableCell className="text-right font-semibold">{meters(t.left)}</TableCell>{isAdmin && <TableCell className="text-right">{rub(t.value)}</TableCell>}</TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="catalog">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>{t("Артикул")}</TableHead><TableHead>{t("Название")}</TableHead><TableHead>{t("Состав")}</TableHead><TableHead>{t("Цвет")}</TableHead><TableHead>{t("Ширина")}</TableHead>{isAdmin && <><TableHead className="text-right">{t("Себестоимость, м")}</TableHead><TableHead className="text-right">{t("Маржа")}</TableHead></>}<TableHead className="text-right">{t("Цена продажи, м")}</TableHead>{isAdmin && <TableHead />}</TableRow></TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}><TableCell className="font-mono text-xs">{p.sku}</TableCell><TableCell className="font-semibold">{p.name}</TableCell><TableCell>{p.composition}</TableCell><TableCell>{p.color}</TableCell><TableCell>{p.width_cm ? `${p.width_cm} см` : "—"}</TableCell>{isAdmin && <><TableCell className="text-right">{rub(Number(pc?.get(p.id)?.cost_price ?? 0))}</TableCell><TableCell className="text-right">{pc?.get(p.id)?.margin_percent != null ? `${pc.get(p.id)!.margin_percent}%` : "—"}</TableCell></>}<TableCell className="text-right">{rub(Number(p.sale_price))}</TableCell>
                    {isAdmin && <TableCell className="w-10"><EditRowDialog title={t("Редактировать товар")} table="products" row={{ ...p, cost_price: pc?.get(p.id)?.cost_price ?? 0, margin_percent: pc?.get(p.id)?.margin_percent ?? null }} fields={PRODUCT_FIELDS} pricing invalidate={["products", "lots", "product-costs"]} /></TableCell>}</TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReceiptDialog({ products, isAdmin }: { products: { id: string; sku: string; name: string }[]; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: suppliers = [] } = useSuppliers();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ product_id: "", supplier_id: "", meters: "", purchase_price: "", note: "" });
  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("stock_receipts").insert({
        product_id: f.product_id,
        supplier_id: f.supplier_id || null,
        meters: Number(f.meters),
        remaining_meters: Number(f.meters),
        note: f.note || null,
      }).select("id").single();
      if (error) throw error;
      if (isAdmin && f.purchase_price) {
        const { error: e2 } = await supabase.rpc("admin_set_receipt_cost", { _id: data.id, _price: Number(f.purchase_price) });
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success(t("Приход оформлен"));
      setOpen(false);
      setF({ product_id: "", supplier_id: "", meters: "", purchase_price: "", note: "" });
      qc.invalidateQueries({ queryKey: ["lots"] });
      qc.invalidateQueries({ queryKey: ["receipt-costs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><PackagePlus className="mr-1 h-4 w-4" /> {t("Оформить приход")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Приход товара на склад")}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!f.product_id) { toast.error(t("Выберите товар")); return; } m.mutate(); }}>
          <div className="space-y-1.5"><Label>{t("Товар")}</Label>
            <Select value={f.product_id} onValueChange={(v) => setF({ ...f, product_id: v })}>
              <SelectTrigger><SelectValue placeholder={t("Выберите ткань")} /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>{t("Поставщик")}</Label>
            <Select value={f.supplier_id} onValueChange={(v) => setF({ ...f, supplier_id: v })}>
              <SelectTrigger><SelectValue placeholder={t("Выберите поставщика")} /></SelectTrigger>
              <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t("Метров")}</Label><Input type="number" step="0.01" min="0.01" required value={f.meters} onChange={(e) => setF({ ...f, meters: e.target.value })} /></div>
            {isAdmin && <div className="space-y-1.5"><Label>{t("Себестоимость за м, ₽")}</Label><Input type="number" step="0.01" min="0" value={f.purchase_price} onChange={(e) => setF({ ...f, purchase_price: e.target.value })} /></div>}
          </div>
          <div className="space-y-1.5"><Label>{t("Комментарий")}</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          <Button className="w-full" disabled={m.isPending}>{t("Принять на склад")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductDialog({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ sku: "", name: "", composition: "", color: "", width_cm: "" });
  const [pr, setPr] = useState<PriceState>({ cost: "", margin: "", sale: "" });
  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("products").insert({
        sku: f.sku, name: f.name, composition: f.composition || null, color: f.color || null,
        width_cm: f.width_cm ? Number(f.width_cm) : null,
      }).select("id").single();
      if (error) throw error;
      if (isAdmin) await savePricing(data.id, pr);
    },
    onSuccess: () => { toast.success(t("Товар добавлен")); setOpen(false); qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["product-costs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="mr-1 h-4 w-4" /> {t("Новый товар")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("Новая позиция номенклатуры")}</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="space-y-1.5"><Label>{t("Артикул")}</Label><Input required value={f.sku} onChange={set("sku")} /></div>
          <div className="space-y-1.5"><Label>{t("Название")}</Label><Input required value={f.name} onChange={set("name")} /></div>
          <div className="space-y-1.5"><Label>{t("Состав")}</Label><Input value={f.composition} onChange={set("composition")} /></div>
          <div className="space-y-1.5"><Label>{t("Цвет")}</Label><Input value={f.color} onChange={set("color")} /></div>
          <div className="space-y-1.5"><Label>{t("Ширина, см")}</Label><Input type="number" value={f.width_cm} onChange={set("width_cm")} /></div>
          {isAdmin && <PricingFields v={pr} onChange={setPr} />}
          <Button className="col-span-2" disabled={m.isPending}>{t("Сохранить")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Field = { key: string; label: string; type?: "number" | "text"; rpc?: boolean };
type PriceState = { cost: string; margin: string; sale: string };

async function savePricing(id: string, p: PriceState) {
  const { error } = await supabase.rpc("admin_set_product_pricing", {
    _id: id, _cost: Number(p.cost || 0), _margin: p.margin === "" ? (null as unknown as number) : Number(p.margin), _sale: Number(p.sale || 0),
  });
  if (error) throw error;
}

/** Cost + margin % → sale price; editing sale price by hand recalculates margin. */
function PricingFields({ v, onChange }: { v: PriceState; onChange: (v: PriceState) => void }) {
  const fromMargin = (cost: string, margin: string) =>
    onChange({ cost, margin, sale: cost !== "" && margin !== "" ? String(saleFromMargin(Number(cost), Number(margin))) : v.sale });
  return (
    <div className="col-span-2 grid grid-cols-3 gap-3 rounded-md border p-3">
      <div className="space-y-1.5"><Label>{t("Себестоимость, ₽/м")}</Label><Input type="number" step="0.01" min="0" value={v.cost} onChange={(e) => fromMargin(e.target.value, v.margin)} /></div>
      <div className="space-y-1.5"><Label>{t("Маржа, %")}</Label><Input type="number" step="0.01" value={v.margin} onChange={(e) => fromMargin(v.cost, e.target.value)} /></div>
      <div className="space-y-1.5"><Label>{t("Цена продажи, ₽/м")}</Label><Input type="number" step="0.01" min="0" required value={v.sale} onChange={(e) => {
        const m = marginFromSale(Number(v.cost), Number(e.target.value));
        onChange({ ...v, sale: e.target.value, margin: m == null ? v.margin : String(m) });
      }} /></div>
    </div>
  );
}

function EditRowDialog({ title, table, row, fields, invalidate, pricing }: {
  title: string; table: "products" | "stock_receipts"; row: Record<string, unknown>; fields: Field[]; invalidate: string[]; pricing?: boolean;
}) {
  const initPr = (): PriceState => ({ cost: String(row["cost_price"] ?? ""), margin: row["margin_percent"] == null ? "" : String(row["margin_percent"]), sale: String(row["sale_price"] ?? "") });
  const [pr, setPr] = useState<PriceState>(initPr);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const init = () => Object.fromEntries(fields.map((f) => [f.key, row[f.key] == null ? "" : String(row[f.key])]));
  const [v, setV] = useState<Record<string, string>>(init);
  const refresh = () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, unknown> = {};
      for (const f of fields) if (!f.rpc) patch[f.key] = f.type === "number" ? (v[f.key] === "" ? null : Number(v[f.key])) : (v[f.key] || null);
      const id = row["id"] as string;
      const { error } = await supabase.from(table).update(patch as never).eq("id", id);
      if (error) throw error;
      if (pricing) await savePricing(id, pr);
      if (table === "stock_receipts") {
        const { error: e2 } = await supabase.rpc("admin_set_receipt_cost", { _id: id, _price: Number(v["purchase_price"] || 0) });
        if (e2) throw e2;
      }
    },
    onSuccess: () => { toast.success(t("Сохранено")); setOpen(false); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from(table).delete().eq("id", row["id"] as string);
      if (error) throw new Error(error.code === "23503" ? t("Нельзя удалить: позиция используется в заказах или партиях") : error.message);
    },
    onSuccess: () => { toast.success(t("Удалено")); setOpen(false); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setV(init()); setPr(initPr()); } }}>
      <DialogTrigger asChild><Button size="icon" variant="ghost" aria-label={t("Редактировать")}><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5"><Label>{f.label}</Label>
              <Input type={f.type ?? "text"} step={f.type === "number" ? "0.01" : undefined} value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            </div>
          ))}
          {pricing && <PricingFields v={pr} onChange={setPr} />}
          <Button type="button" variant="destructive" disabled={del.isPending} onClick={() => { if (confirm(t("Удалить позицию?"))) del.mutate(); }}>
            <Trash2 className="mr-1 h-4 w-4" /> {t("Удалить")}
          </Button>
          <Button disabled={save.isPending}>{t("Сохранить")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const PRODUCT_FIELDS: Field[] = [
  { key: "sku", label: t("Артикул") }, { key: "name", label: t("Название") }, { key: "composition", label: t("Состав") },
  { key: "color", label: t("Цвет") }, { key: "width_cm", label: t("Ширина, см"), type: "number" },
];
const LOT_FIELDS: Field[] = [
  { key: "meters", label: t("Пришло, м"), type: "number" }, { key: "remaining_meters", label: t("Осталось, м"), type: "number" },
  { key: "purchase_price", label: t("Себестоимость за м, ₽"), type: "number", rpc: true }, { key: "note", label: t("Комментарий") },
];
