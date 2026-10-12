import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const inviteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; fullName: string }) => data)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    const fullName = data.fullName.trim();
    if (!email || !email.includes("@")) throw new Error("Укажите корректный email");
    if (!fullName) throw new Error("Укажите имя сотрудника");

    // Only super_admin may invite
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Приглашать сотрудников может только супер-админ");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    });
    if (error) {
      if (error.message.toLowerCase().includes("already")) {
        throw new Error("Пользователь с таким email уже зарегистрирован");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });
