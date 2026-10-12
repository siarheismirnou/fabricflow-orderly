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
  head: () => ({
    meta: [
      { title: "Вход — Ткани" },
      { name: "description", content: "Вход сотрудников во внутреннюю систему" },
      { property: "og:title", content: "Вход — Ткани" },
      { property: "og:description", content: "Вход сотрудников во внутреннюю систему" },
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
    if (error) return toast.error("Неверный email или пароль");
    navigate({ to: "/dashboard" });
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
    if (error) return toast.error(error.message);
    toast.success("Проверьте почту для подтверждения регистрации");
  }
  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) return toast.error("Не удалось войти через Google");
    if (r.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="weave-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-3xl font-semibold">Ткани</h1>
        <p className="mt-1 text-sm text-muted-foreground">Внутренняя система компании</p>
        <Tabs defaultValue="in" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="in">Вход</TabsTrigger>
            <TabsTrigger value="up">Регистрация</TabsTrigger>
          </TabsList>
          <TabsContent value="in">
            <form onSubmit={signIn} className="space-y-3 pt-2">
              <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Пароль"><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
              <Button className="w-full" disabled={busy}>Войти</Button>
            </form>
          </TabsContent>
          <TabsContent value="up">
            <form onSubmit={signUp} className="space-y-3 pt-2">
              <Field label="ФИО"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Пароль"><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
              <Button className="w-full" disabled={busy}>Зарегистрироваться</Button>
            </form>
          </TabsContent>
        </Tabs>
        <Button variant="outline" className="mt-4 w-full" onClick={google}>Войти через Google</Button>
        <p className="mt-4 text-xs text-muted-foreground">Первый зарегистрированный пользователь становится супер-админом. Остальным роли назначает администратор или специалист по кадрам.</p>
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
