import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useProduction } from "@/lib/production/store";
import {
  computeLoad,
  forecastLoad,
  nodeLabel,
  routeTransitions,
  transferHours,
  weeklyCapacity,
  workersNeeded,
} from "@/lib/production/workload";

export const Route = createFileRoute("/_authenticated/workcenters")({
  head: () => ({
    meta: [
      { title: "Участки — загрузка, аутсорс и транспортировка" },
      {
        name: "description",
        content:
          "Часы работы по участкам, прогноз загрузки при запуске новой партии, потребность в найме и время транспортировки между участками и подрядчиками.",
      },
      { property: "og:title", content: "Участки — загрузка, аутсорс и транспортировка" },
      {
        property: "og:description",
        content: "Сколько часов работы приходится на каждый участок и хватит ли людей на новую партию.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkcentersPage,
});

const inputCls =
  "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

function WorkcentersPage() {
  const {
    workcenters,
    transfers,
    products,
    batches,
    effectiveProduct,
    addWorkcenter,
    updateWorkcenter,
    removeWorkcenter,
    setTransfer,
  } = useProduction();

  const [query, setQuery] = useState("");
  const [forecastProductId, setForecastProductId] = useState(products[0]?.id ?? "");
  const [forecastQty, setForecastQty] = useState(50);
  const [forecastWeeks, setForecastWeeks] = useState(6);

  const rows = useMemo(
    () => batches.map((b) => ({ batch: b, product: effectiveProduct(b) })),
    [batches, effectiveProduct],
  );

  const load = useMemo(
    () => computeLoad(rows, workcenters, transfers),
    [rows, workcenters, transfers],
  );

  const forecastProduct = products.find((p) => p.id === forecastProductId);
  const forecast = useMemo(
    () =>
      forecastProduct ? forecastLoad(forecastProduct, forecastQty, workcenters, transfers) : [],
    [forecastProduct, forecastQty, workcenters, transfers],
  );
  const forecastByNode = new Map(forecast.map((f) => [f.node, f]));

  const effectiveProducts = useMemo(
    () => [...products, ...rows.map((r) => r.product)],
    [products, rows],
  );
  const transitions = useMemo(() => routeTransitions(effectiveProducts), [effectiveProducts]);

  const q = query.trim().toLowerCase();
  const visibleLoad = q ? load.filter((l) => l.label.toLowerCase().includes(q)) : load;

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Участки и загрузка</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Часы работы по участкам и подрядчикам, прогноз найма и время транспортировки.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск участка…"
            className={`${inputCls} w-52`}
          />
          <button
            type="button"
            onClick={() => addWorkcenter()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Новый участок
          </button>
        </div>
      </header>

      <div className="space-y-6 p-6">
        {/* Загрузка */}
        <section className="overflow-x-auto rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Текущая загрузка (остаток по активным партиям)
          </div>
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Участок / подрядчик</th>
                <th className="px-3 py-2 font-medium">Рабочих</th>
                <th className="px-3 py-2 font-medium">ч/чел в неделю</th>
                <th className="px-3 py-2 font-medium">Часы работы</th>
                <th className="px-3 py-2 font-medium">Транспорт, ч</th>
                <th className="px-3 py-2 font-medium">Партий</th>
                <th className="px-3 py-2 font-medium">Недель загрузки</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {visibleLoad.map((l) => {
                const wc = workcenters.find((w) => w.id === l.node);
                const cap = wc ? weeklyCapacity(wc) : 0;
                const weeks = cap > 0 ? (l.hours / cap).toFixed(1) : "—";
                return (
                  <tr key={l.node} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      {wc ? (
                        <input
                          value={wc.name}
                          onChange={(e) => updateWorkcenter(wc.id, { name: e.target.value })}
                          className={`${inputCls} w-56`}
                        />
                      ) : (
                        <span className={l.outsource ? "text-status-wait" : "text-muted-foreground"}>
                          {l.label}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {wc ? (
                        <input
                          type="number"
                          min={0}
                          value={wc.workers}
                          onChange={(e) => updateWorkcenter(wc.id, { workers: Number(e.target.value) })}
                          className={`${inputCls} w-16 tabular-nums`}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {wc ? (
                        <input
                          type="number"
                          min={0}
                          value={wc.hoursPerWorkerPerWeek}
                          onChange={(e) =>
                            updateWorkcenter(wc.id, { hoursPerWorkerPerWeek: Number(e.target.value) })
                          }
                          className={`${inputCls} w-16 tabular-nums`}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-medium text-foreground">{l.hours} ч</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{l.transferHours} ч</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{l.batches}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{weeks}</td>
                    <td className="px-3 py-2 text-right">
                      {wc && (
                        <button
                          type="button"
                          onClick={() => removeWorkcenter(wc.id)}
                          className="rounded p-1 text-muted-foreground hover:text-status-block"
                          aria-label="Удалить участок"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleLoad.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-muted-foreground">
                    Ничего не найдено.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Прогноз */}
        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Прогноз загрузки при запуске новой партии
          </div>
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
            <select
              value={forecastProductId}
              onChange={(e) => setForecastProductId(e.target.value)}
              className={inputCls}
              aria-label="Изделие для прогноза"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              количество, шт
              <input
                type="number"
                min={1}
                value={forecastQty}
                onChange={(e) => setForecastQty(Math.max(1, Number(e.target.value)))}
                className={`${inputCls} w-20 tabular-nums`}
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              срок, недель
              <input
                type="number"
                min={1}
                value={forecastWeeks}
                onChange={(e) => setForecastWeeks(Math.max(1, Number(e.target.value)))}
                className={`${inputCls} w-20 tabular-nums`}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Участок / подрядчик</th>
                  <th className="px-3 py-2 font-medium">Сейчас, ч</th>
                  <th className="px-3 py-2 font-medium">Новая партия, ч</th>
                  <th className="px-3 py-2 font-medium">Итого, ч</th>
                  <th className="px-3 py-2 font-medium">Мощность за срок, ч</th>
                  <th className="px-3 py-2 font-medium">Нужно рабочих</th>
                  <th className="px-3 py-2 font-medium">Найм</th>
                </tr>
              </thead>
              <tbody>
                {load.map((l) => {
                  const add = forecastByNode.get(l.node);
                  const addHours = (add?.hours ?? 0) + (add?.transferHours ?? 0);
                  const total = l.hours + l.transferHours + addHours;
                  const wc = workcenters.find((w) => w.id === l.node);
                  if (!wc) {
                    return (
                      <tr key={l.node} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 text-status-wait">{l.label}</td>
                        <td className="px-3 py-2 tabular-nums">{l.hours}</td>
                        <td className="px-3 py-2 tabular-nums">{addHours}</td>
                        <td className="px-3 py-2 tabular-nums font-medium text-foreground">{total}</td>
                        <td className="px-3 py-2 text-muted-foreground" colSpan={3}>
                          сторонняя организация — своя мощность
                        </td>
                      </tr>
                    );
                  }
                  const capacity = weeklyCapacity(wc) * forecastWeeks;
                  const need = workersNeeded(total, forecastWeeks, wc.hoursPerWorkerPerWeek);
                  const hire = Math.max(0, need - wc.workers);
                  return (
                    <tr key={l.node} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 text-foreground">{wc.name}</td>
                      <td className="px-3 py-2 tabular-nums">{l.hours + l.transferHours}</td>
                      <td className="px-3 py-2 tabular-nums">{addHours}</td>
                      <td className="px-3 py-2 tabular-nums font-medium text-foreground">{total}</td>
                      <td
                        className={`px-3 py-2 tabular-nums ${
                          total > capacity ? "text-status-block" : "text-muted-foreground"
                        }`}
                      >
                        {capacity}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{need}</td>
                      <td className="px-3 py-2">
                        {hire > 0 ? (
                          <span className="rounded border border-status-block/40 bg-status-block/10 px-2 py-0.5 text-status-block">
                            +{hire} чел
                          </span>
                        ) : (
                          <span className="text-status-done">хватает</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Транспортировка */}
        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Время транспортировки между узлами маршрута
          </div>
          <div className="p-4">
            {transitions.length === 0 && (
              <div className="text-xs text-muted-foreground">
                В маршрутах нет переходов между разными участками.
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {transitions.map((t) => (
                <div
                  key={`${t.from}>${t.to}`}
                  className="flex items-center gap-2 rounded-md border border-border bg-background p-2 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {nodeLabel(t.from, workcenters)} → {nodeLabel(t.to, workcenters)}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={transferHours(transfers, t.from, t.to)}
                    onChange={(e) => setTransfer(t.from, t.to, Number(e.target.value))}
                    className={`${inputCls} w-16 tabular-nums`}
                    aria-label={`Транспортировка ${t.from} ${t.to}`}
                  />
                  <span className="text-muted-foreground">ч</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
