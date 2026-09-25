import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listJournal } from "@/lib/production/accounts.functions";
import { SECTIONS, SECTION_TITLE } from "@/lib/production/sections";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "Журнал событий — управление производством" },
      { name: "description", content: "Кто, когда и что изменил в партиях, изделиях, договорах и учётных записях." },
      { property: "og:title", content: "Журнал событий — управление производством" },
      { property: "og:description", content: "История изменений производственных данных." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JournalPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function JournalPage() {
  const fetchJournal = useServerFn(listJournal);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [user, setUser] = useState("");
  const [section, setSection] = useState("");

  const range = useMemo(() => {
    const f = new Date(from + "T00:00:00");
    const t = new Date(to + "T00:00:00");
    t.setDate(t.getDate() + 1);
    return { from: f.toISOString(), to: t.toISOString() };
  }, [from, to]);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["journal", range],
    queryFn: () => fetchJournal({ data: range }),
  });

  const users = Array.from(new Set(data.map((r) => r.user_name ?? "—")));
  const rows = data.filter((r) => (!user || (r.user_name ?? "—") === user) && (!section || r.section === section));
  const input = "rounded-md border border-border bg-background px-2 py-1 text-xs";

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Журнал событий</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">с</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
          <span className="text-muted-foreground">по</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
          <select value={user} onChange={(e) => setUser(e.target.value)} className={input}>
            <option value="">Все пользователи</option>
            {users.map((u) => <option key={u}>{u}</option>)}
          </select>
          <select value={section} onChange={(e) => setSection(e.target.value)} className={input}>
            <option value="">Все разделы</option>
            {SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
      </header>
      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : error ? (
          <p className="text-sm text-destructive">Не удалось загрузить журнал</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">За выбранный период событий нет.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3">Время</th><th className="pr-3">Пользователь</th>
                <th className="pr-3">Раздел</th><th className="pr-3">Действие</th><th>Объект</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString("ru-RU")}</td>
                  <td className="pr-3">{r.user_name ?? "—"}</td>
                  <td className="pr-3">{SECTION_TITLE[r.section] ?? r.section}</td>
                  <td className="pr-3">{r.action}</td>
                  <td>{r.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
