import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  resetPassword,
  setPermissions,
  type Account,
} from "@/lib/production/accounts.functions";
import { SECTIONS } from "@/lib/production/sections";

const input = "rounded-md border border-border bg-background px-2 py-1.5 text-xs";
const btn = "rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/50 disabled:opacity-50";

export function AccountsSection() {
  const qc = useQueryClient();
  const list = useServerFn(listAccounts);
  const create = useServerFn(createAccount);
  const { data = [], isLoading } = useQuery({ queryKey: ["accounts"], queryFn: () => list() });
  const [form, setForm] = useState({ login: "", name: "", password: "" });
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await create({ data: form });
      setForm({ login: "", name: "", password: "" });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section>
      <h2 className="text-sm font-medium">Учётные записи</h2>
      <form onSubmit={add} className="mt-2 flex flex-wrap gap-2">
        <input required placeholder="Логин" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} className={input} />
        <input placeholder="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
        <input required minLength={6} type="password" placeholder="Пароль" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={input} />
        <button type="submit" className={btn}>Создать</button>
      </form>
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
      <div className="mt-3 divide-y divide-border rounded-md border border-border">
        {isLoading && <p className="p-3 text-xs text-muted-foreground">Загрузка…</p>}
        {data.map((a) => (
          <div key={a.id}>
            <button type="button" onClick={() => setOpenId(openId === a.id ? null : a.id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent/30">
              <span>
                <span className="font-medium">{a.login}</span>
                <span className="ml-2 text-muted-foreground">{a.name}</span>
              </span>
              {a.isAdmin && <span className="text-xs text-primary">Администратор</span>}
            </button>
            {openId === a.id && <AccountCard account={a} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function AccountCard({ account }: { account: Account }) {
  const qc = useQueryClient();
  const savePerms = useServerFn(setPermissions);
  const reset = useServerFn(resetPassword);
  const remove = useServerFn(deleteAccount);
  const [isAdmin, setIsAdmin] = useState(account.isAdmin);
  const [perms, setPerms] = useState(account.permissions);
  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      qc.invalidateQueries({ queryKey: ["accounts"] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const toggle = (section: string, access: "edit" | "view") =>
    setPerms((p) => {
      const n = { ...p };
      if (n[section] === access) delete n[section];
      else n[section] = access;
      return n;
    });

  return (
    <div className="space-y-3 bg-muted/30 px-3 py-3">
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
        Администратор (полный доступ ко всему)
      </label>
      <table className="text-xs">
        <thead className="text-muted-foreground">
          <tr><th className="pr-4 text-left font-normal">Раздел</th><th className="px-3 font-normal">Просмотр и редактирование</th><th className="px-3 font-normal">Только просмотр</th></tr>
        </thead>
        <tbody>
          {SECTIONS.map((s) => (
            <tr key={s.id}>
              <td className="py-1 pr-4">{s.title}</td>
              {(["edit", "view"] as const).map((a) => (
                <td key={a} className="text-center">
                  <input type="checkbox" disabled={isAdmin} checked={isAdmin || perms[s.id] === a} onChange={() => toggle(s.id, a)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">Без отметки раздел скрыт от пользователя.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => run(() => savePerms({ data: { id: account.id, login: account.login, isAdmin, permissions: perms } }), "Права сохранены")}>Сохранить права</button>
        <input type="password" placeholder="Новый пароль" value={pwd} onChange={(e) => setPwd(e.target.value)} className={input} />
        <button type="button" disabled={pwd.length < 6} className={btn} onClick={() => run(() => reset({ data: { id: account.id, login: account.login, password: pwd } }).then(() => setPwd("")), "Пароль изменён")}>Сменить пароль</button>
        <button type="button" className={`${btn} text-destructive`} onClick={() => confirm(`Удалить учётную запись ${account.login}?`) && run(() => remove({ data: { id: account.id, login: account.login } }), "Удалено")}>Удалить</button>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
