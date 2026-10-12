import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "./PageHeader";

type Field = { key: string; label: string; required?: boolean };

export function DirectoryPage({
  table,
  title,
  subtitle,
  fields,
  canEdit,
}: {
  table: "clients" | "suppliers";
  title: string;
  subtitle: string;
  fields: Field[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const { data = [] } = useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("*").order("name");
      if (error) throw error;
      return data as Record<string, string>[];
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from(table).insert(form as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сохранено");
      setOpen(false);
      setForm({});
      qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
    onError: () => toast.error("Нельзя удалить: запись используется"),
  });
  const rows = data.filter((r) => fields.some((f) => (r[f.key] ?? "").toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-1 h-4 w-4" /> Добавить</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Новая запись</DialogTitle></DialogHeader>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    add.mutate();
                  }}
                >
                  {fields.map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <Label>{f.label}</Label>
                      <Input required={f.required} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                    </div>
                  ))}
                  <Button className="w-full" disabled={add.isPending}>Сохранить</Button>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {fields.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
              {canEdit && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r["id"]}>
                {fields.map((f, i) => <TableCell key={f.key} className={i === 0 ? "font-semibold" : ""}>{r[f.key] || "—"}</TableCell>)}
                {canEdit && (
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => confirm("Удалить запись?") && del.mutate(r["id"]!)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={fields.length + 1} className="py-8 text-center text-muted-foreground">Ничего не найдено</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
