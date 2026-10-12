import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { hasAny, useMe } from "@/lib/auth";
import { ROLE_LABELS, type AppRole } from "@/lib/domain";
import { inviteEmployee } from "@/lib/employees.functions";
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

const ALL_ROLES = Object.keys(ROLE_LABELS) as AppRole[];

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
  const invite = useMutation({
    mutationFn: () => inviteEmployee({ data: { email: inviteEmail, fullName: inviteName } }),
    onSuccess: () => {
      toast.success("Приглашение отправлено на почту сотрудника");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
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

  if (!hasAny(me?.roles, ["hr"])) return <p className="text-muted-foreground">Раздел доступен супер-админу и специалисту по кадрам.</p>;

  return (
    <div>
      <PageHeader title="Сотрудники" subtitle="Назначение ролей и доступов. Новые сотрудники появляются здесь после регистрации." />
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
