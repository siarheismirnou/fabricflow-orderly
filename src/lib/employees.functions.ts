import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROJECT_ROLES = ["super_admin", "sales_manager", "accountant"] as const;
type ProjectRole = (typeof PROJECT_ROLES)[number];

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("") + "!7";
}

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; fullName: string; role: ProjectRole }) => data)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    const fullName = data.fullName.trim();
    if (!email || !email.includes("@")) throw new Error("Укажите корректный email");
    if (!fullName) throw new Error("Укажите имя сотрудника");
    if (!PROJECT_ROLES.includes(data.role)) throw new Error("Неизвестная роль");

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Добавлять сотрудников может только супер-админ");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = genPassword();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !created.user) {
      if (error?.message.toLowerCase().includes("already")) throw new Error("Пользователь с таким email уже зарегистрирован");
      throw new Error(error?.message ?? "Не удалось создать сотрудника");
    }
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: data.role }, { onConflict: "user_id,role" });
    if (roleErr) throw new Error(roleErr.message);
    return { password };
  });
