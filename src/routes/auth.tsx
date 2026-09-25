import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ensureDevAdmin } from "@/lib/production/accounts.functions";
import { DEV_ADMIN_LOGIN, DEV_ADMIN_PASSWORD, DEV_AUTOLOGIN, loginToEmail } from "@/lib/production/sections";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Вход — Система управления производством" },
      { name: "description", content: "Вход по логину и паролю в систему управления производством." },
      { property: "og:title", content: "Вход — Система управления производством" },
      { property: "og:description", content: "Доступ к тех.маршрутам, партиям и договорам предприятия." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(DEV_AUTOLOGIN);

  useEffect(() => {
    if (!DEV_AUTOLOGIN) return;
    (async () => {
      try {
        await ensureDevAdmin();
        const { error: err } = await supabase.auth.signInWithPassword({
          email: loginToEmail(DEV_ADMIN_LOGIN),
          password: DEV_ADMIN_PASSWORD,
        });
        if (err) throw err;
        navigate({ to: "/" });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setAuto(false);
      }
    })();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: loginToEmail(login), password });
    setBusy(false);
    if (err) {
      setError("Неверный логин или пароль");
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Управление производством</h1>
        {auto ? (
          <p className="mt-3 text-sm text-muted-foreground">Автоматический вход…</p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Логин"
              autoComplete="username"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              autoComplete="current-password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {error && <div className="text-sm text-destructive">{error}</div>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Подождите…" : "Войти"}
            </button>
            <p className="text-xs text-muted-foreground">Учётные записи выдаёт администратор.</p>
          </form>
        )}
      </div>
    </div>
  );
}
