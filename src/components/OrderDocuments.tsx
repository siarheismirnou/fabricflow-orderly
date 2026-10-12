import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hasAny } from "@/lib/auth";
import { STATUS_FLOW, type OrderStatus } from "@/lib/domain";
import type { AppRole } from "@/lib/domain";
import { Button } from "@/components/ui/button";

type Kind = "supplier_invoice" | "payment_order";
const CFG: Record<Kind, { title: string; roles: AppRole[]; from: OrderStatus }> = {
  supplier_invoice: { title: "Счёт от поставщика", roles: ["super_admin", "sales_manager", "warehouse"], from: "in_progress" },
  payment_order: { title: "Платёжное поручение", roles: ["super_admin", "accountant"], from: "awaiting_payment" },
};

export function OrderDocuments({ orderId, status, roles, userId }: { orderId: string; status: OrderStatus; roles: AppRole[]; userId?: string }) {
  const qc = useQueryClient();
  const { data: docs = [] } = useQuery({
    queryKey: ["order-docs", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("order_documents").select("*").eq("order_id", orderId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const idx = STATUS_FLOW.indexOf(status);
  const kinds = (Object.keys(CFG) as Kind[]).filter((k) => idx >= STATUS_FLOW.indexOf(CFG[k].from));
  if (!kinds.length) return null;

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {kinds.map((k) => (
        <DocBlock key={k} kind={k} orderId={orderId} docs={docs.filter((d) => d.kind === k)}
          canUpload={hasAny(roles, CFG[k].roles) && status === CFG[k].from} isAdmin={roles.includes("super_admin")} userId={userId}
          onChange={() => qc.invalidateQueries({ queryKey: ["order-docs", orderId] })} />
      ))}
    </div>
  );
}

function DocBlock({ kind, orderId, docs, canUpload, isAdmin, userId, onChange }: {
  kind: Kind; orderId: string; docs: { id: string; file_path: string; file_name: string; uploaded_by: string | null; created_at: string }[];
  canUpload: boolean; isAdmin: boolean; userId?: string; onChange: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${orderId}/${kind}-${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("order-documents").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from("order_documents").insert({ order_id: orderId, kind, file_path: path, file_name: file.name });
      if (error) { await supabase.storage.from("order-documents").remove([path]); throw error; }
    },
    onSuccess: () => { toast.success("Файл прикреплён"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (d: { id: string; file_path: string }) => {
      const { error } = await supabase.from("order_documents").delete().eq("id", d.id);
      if (error) throw error;
      await supabase.storage.from("order-documents").remove([d.file_path]);
    },
    onSuccess: onChange,
    onError: (e: Error) => toast.error(e.message),
  });
  const open = async (path: string) => {
    const { data, error } = await supabase.storage.from("order-documents").createSignedUrl(path, 300);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{CFG[kind].title} <span className="text-xs font-normal text-muted-foreground">· необязательно</span></h3>
        {canUpload && <>
          <input ref={input} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
          <Button size="sm" variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>
            <Paperclip className="mr-1 h-4 w-4" />{upload.isPending ? "Загрузка…" : "Прикрепить"}
          </Button>
        </>}
      </div>
      {docs.length === 0 ? <p className="text-sm text-muted-foreground">Файл не прикреплён</p> : (
        <ul className="space-y-2 text-sm">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <button className="truncate text-left underline-offset-2 hover:underline" onClick={() => open(d.file_path)}>{d.file_name}</button>
              <span className="ml-auto text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString("ru-RU")}</span>
              {(isAdmin || d.uploaded_by === userId) && (
                <button aria-label="Удалить" className="text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(d)}><Trash2 className="h-4 w-4" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
