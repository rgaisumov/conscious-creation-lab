import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Вход — Система управления производством" },
      { name: "description", content: "Вход и регистрация в системе управления производством электронных изделий." },
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name: name || email },
          },
        });
        if (err) throw err;
        if (!data.session) {
          setInfo("Проверьте почту — отправлено письмо для подтверждения регистрации.");
          return;
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (err) setError(err.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Управление производством</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Вход в систему" : "Регистрация нового пользователя"}
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "signup" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Имя и фамилия"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Электронная почта"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />

          {error && <div className="text-sm text-destructive">{error}</div>}
          {info && <div className="text-sm text-muted-foreground">{info}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Подождите…" : mode === "signin" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        <button
          type="button"
          onClick={google}
          className="mt-3 w-full rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          Войти через Google
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setInfo(null);
          }}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}
