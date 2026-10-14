import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { hasAny, useMe } from "@/lib/auth";
import { ROLE_LABELS, type AppRole } from "@/lib/domain";
import { createEmployee } from "@/lib/employees.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfiles } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({ meta: [{ title: "Сотрудники — Ткани" }, { name: "description", content: "Сотрудники и их роли" }, { property: "og:title", content: "Сотрудники — Ткани" }, { property: "og:description", content: "Сотрудники и их роли" }] }),
  component: Employees,
});

const ALL_ROLES: AppRole[] = ["super_admin", "sales_manager", "accountant"];
type NewRole = "super_admin" | "sales_manager" | "accountant";

function Employees() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: profiles = [] } = useProfiles();
  const { data: roles = [] } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });
  const isAdmin = me?.roles.includes("super_admin");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<NewRole>("sales_manager");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const invite = useMutation({
    mutationFn: () => createEmployee({ data: { email: inviteEmail, fullName: inviteName, role: inviteRole } }),
    onSuccess: (r) => {
      toast.success("Сотрудник добавлен");
      setCreated({ email: inviteEmail, password: r.password });
      setInviteEmail("");
      setInviteName("");
      qc.invalidateQueries({ queryKey: ["all-roles"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ user_id, role, on }: { user_id: string; role: AppRole; on: boolean }) => {
      const { error } = on
        ? await supabase.from("user_roles").insert({ user_id, role })
        : await supabase.from("user_roles").delete().eq("user_id", user_id).eq("role", role);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-roles"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) return <p className="text-muted-foreground">Раздел доступен только супер-админу.</p>;

  return (
    <div>
      <PageHeader
        title="Сотрудники"
        subtitle="Супер-админ добавляет сотрудника, выбирает роль и получает пароль для первого входа."
        actions={
          <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setCreated(null); }}>
            <DialogTrigger asChild>
              <Button><UserPlus className="mr-2 h-4 w-4" />Добавить сотрудника</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Добавить сотрудника</DialogTitle></DialogHeader>
              {created ? (
                <div className="space-y-3 text-sm">
                  <p>Сотрудник создан. Данные для первого входа:</p>
                  <div className="rounded-md border bg-muted p-3 font-mono">
                    <div>{created.email}</div>
                    <div>{created.password}</div>
                  </div>
                  <Button className="w-full" onClick={() => { navigator.clipboard.writeText(`Email: ${created.email}\nПароль: ${created.password}`); toast.success("Скопировано"); }}>Скопировать</Button>
                  <Button variant="outline" className="w-full" onClick={() => setCreated(null)}>Добавить ещё</Button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
                  <div className="space-y-2">
                    <Label htmlFor="inv-name">Имя и фамилия</Label>
                    <Input id="inv-name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-email">Email</Label>
                    <Input id="inv-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Роль</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as NewRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={invite.isPending}>
                    {invite.isPending ? "Создание…" : "Создать сотрудника"}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        }
      />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Сотрудник</TableHead>{ALL_ROLES.map((r) => <TableHead key={r} className="text-center">{ROLE_LABELS[r]}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.id}>
                <TableCell><div className="font-semibold">{p.full_name}</div><div className="text-xs text-muted-foreground">{p.email}</div></TableCell>
                {ALL_ROLES.map((r) => {
                  const on = roles.some((x) => x.user_id === p.id && x.role === r);
                  const disabled = (r === "super_admin" && !isAdmin) || (p.id === me?.id && r === "super_admin");
                  return (
                    <TableCell key={r} className="text-center">
                      <Checkbox checked={on} disabled={disabled || toggle.isPending} onCheckedChange={(v) => toggle.mutate({ user_id: p.id, role: r, on: !!v })} />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
