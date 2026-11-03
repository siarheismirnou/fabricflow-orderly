import { t } from "@/lib/i18n";
import { LangSwitch } from "@/components/LangSwitch";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: t("Вход — Ткани") },
      { name: "description", content: t("Вход сотрудников во внутреннюю систему") },
      { property: "og:title", content: t("Вход — Ткани") },
      { property: "og:description", content: t("Вход сотрудников во внутреннюю систему") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(t("Неверный email или пароль")); return; }
    navigate({ to: "/" });
  }
  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("Проверьте почту для подтверждения регистрации"));
  }
  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error(t("Не удалось войти через Google")); return; }
    if (r.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <div className="weave-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex items-start justify-between"><h1 className="text-3xl font-semibold">Designtex</h1><LangSwitch /></div>
        <p className="mt-1 text-sm text-muted-foreground">{t("Внутренняя система компании")}</p>
        <Tabs defaultValue="in" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="in">{t("Вход")}</TabsTrigger>
            <TabsTrigger value="up">{t("Регистрация")}</TabsTrigger>
          </TabsList>
          <TabsContent value="in">
            <form onSubmit={signIn} className="space-y-3 pt-2">
              <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label={t("Пароль")}><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
              <Button className="w-full" disabled={busy}>{t("Войти")}</Button>
              <button type="button" className="w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={async () => {
                if (!email) { toast.error(t("Введите email")); return; }
                const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
                if (error) toast.error(error.message); else toast.success(t("Письмо для смены пароля отправлено"));
              }}>{t("Забыли пароль?")}</button>
            </form>
          </TabsContent>
          <TabsContent value="up">
            <form onSubmit={signUp} className="space-y-3 pt-2">
              <Field label={t("ФИО")}><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label={t("Пароль")}><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
              <Button className="w-full" disabled={busy}>{t("Зарегистрироваться")}</Button>
            </form>
          </TabsContent>
        </Tabs>
        <Button variant="outline" className="mt-4 w-full" onClick={google}>{t("Войти через Google")}</Button>
        <p className="mt-4 text-xs text-muted-foreground">{t("Первый зарегистрированный пользователь становится супер-админом. Остальным роли назначает администратор или специалист по кадрам.")}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
