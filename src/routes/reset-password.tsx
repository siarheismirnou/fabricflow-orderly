import { t } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: t("Новый пароль — Ткани") },
      { name: "description", content: t("Установка нового пароля сотрудника") },
      { property: "og:title", content: t("Новый пароль — Ткани") },
      { property: "og:description", content: t("Установка нового пароля сотрудника") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("Пароль изменён"));
    navigate({ to: "/" });
  }
  return (
    <div className="weave-bg flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">{t("Новый пароль")}</h1>
        <div className="space-y-1.5"><Label>{t("Пароль")}</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button className="w-full" disabled={busy}>{t("Сохранить")}</Button>
      </form>
    </div>
  );
}
