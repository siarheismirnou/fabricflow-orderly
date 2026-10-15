import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Boxes, LayoutDashboard, LogOut, ShoppingBag, Truck, Users, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, hasAny } from "@/lib/auth";
import { ROLE_LABELS, type AppRole } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

const NAV: { to: "/dashboard" | "/orders" | "/warehouse" | "/clients" | "/suppliers" | "/employees"; label: string; icon: typeof Bell; roles?: AppRole[] }[] = [
  { to: "/dashboard", label: "Отчёты", icon: LayoutDashboard },
  { to: "/orders", label: "Заказы", icon: ShoppingBag },
  { to: "/warehouse", label: "Склад", icon: Boxes },
  { to: "/clients", label: "Клиенты", icon: Users },
  { to: "/suppliers", label: "Поставщики", icon: Truck },
  { to: "/employees", label: "Сотрудники", icon: UserCog, roles: ["super_admin"] },
];

function Layout() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: unread = 0 } = useQuery({
    queryKey: ["unread"],
    queryFn: async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!me?.id) return;
    const ch = supabase
      .channel("notif-" + me.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["unread"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me?.id, qc]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-5 py-6">
          <div className="font-display text-2xl font-semibold">Designtex</div>
          <div className="text-xs opacity-70">учёт и продажи</div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.filter((n) => !n.roles || hasAny(me?.roles, n.roles)).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
          <Link
            to="/notifications"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
            activeProps={{ className: "bg-sidebar-accent font-semibold" }}
          >
            <Bell className="h-4 w-4" /> Уведомления
            {unread > 0 && (
              <span className="ml-auto rounded-full bg-sidebar-primary px-2 text-xs text-sidebar-primary-foreground">{unread}</span>
            )}
          </Link>
        </nav>
        <div className="border-t border-sidebar-border p-4 text-sm">
          <div className="truncate font-semibold">{me?.name}</div>
          <div className="text-xs opacity-70">
            {me?.roles.length ? me.roles.map((r) => ROLE_LABELS[r]).join(", ") : "Роль не назначена"}
          </div>
          <button onClick={signOut} className="mt-3 flex items-center gap-2 text-xs opacity-80 hover:opacity-100">
            <LogOut className="h-3.5 w-3.5" /> Выйти
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">
        {me && me.roles.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <h2 className="text-xl font-semibold">Ожидается назначение роли</h2>
            <p className="mt-2 text-sm text-muted-foreground">Попросите администратора или специалиста по кадрам выдать вам доступ.</p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
