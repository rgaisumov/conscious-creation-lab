import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, Plus, Search } from "lucide-react";
import { useProduction } from "@/lib/production/store";
import type { Batch, BatchHealth, Summary } from "@/lib/production/types";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Производство — узкие места партий" },
      {
        name: "description",
        content:
          "Дашборд начальника производства: активные партии, текущие блокеры, отставание от срока и прогресс выпуска.",
      },
      { property: "og:title", content: "Производство — узкие места партий" },
      {
        property: "og:description",
        content: "Что сегодня мешает выпустить больше изделий: блокеры и сроки по всем партиям.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductionDashboard,
});

const HEALTH: Record<BatchHealth, { label: string; cls: string; bar: string }> = {
  ok: { label: "В графике", cls: "text-status-done border-status-done/40 bg-status-done/10", bar: "bg-status-done" },
  risk: { label: "Риск", cls: "text-status-wait border-status-wait/40 bg-status-wait/10", bar: "bg-status-wait" },
  late: { label: "Отставание", cls: "text-status-block border-status-block/40 bg-status-block/10", bar: "bg-status-block" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function BatchCard({ batch, summary, productName }: { batch: Batch; summary: Summary; productName: string }) {
  const h = HEALTH[summary.health];
  return (
    <Link
      to="/batches/$batchId"
      params={{ batchId: batch.id }}
      className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-card-foreground truncate">{productName}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">Партия {batch.number} · {batch.orderedQty} шт</div>
        </div>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-[11px] font-medium ${h.cls}`}>
          {h.label}
          {summary.delayDays > 0 ? ` · ${summary.delayDays} дн` : ""}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Отгружено {summary.shipped}/{summary.batchSize}</span>
          <span>{summary.progressPct}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted">
          <div className={`h-full ${h.bar}`} style={{ width: `${summary.progressPct}%` }} />
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/40 p-2">
        <AlertTriangle
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
            summary.blockers.length > 0 ? "text-status-block" : "text-muted-foreground"
          }`}
        />
        <span className="text-xs text-muted-foreground leading-snug">{summary.primaryBlockingReason}</span>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5" />
          Срок {fmtDate(batch.dueDate)}
        </span>
        <span className="flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Открыть <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function ProductionDashboard() {
  const { batches, products, getProduct, summaryOf, addBatch } = useProduction();
  const navigate = useNavigate();
  const [productId, setProductId] = useState(products[0]?.id ?? "");

  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<"all" | BatchHealth>("all");
  const [filterProductId, setFilterProductId] = useState("all");
  const [onlyBlocked, setOnlyBlocked] = useState(false);

  const allRows = batches
    .map((b) => ({ batch: b, summary: summaryOf(b), product: getProduct(b.productId) }))
    .sort((a, b) => {
      const rank = { late: 0, risk: 1, ok: 2 } as const;
      return rank[a.summary.health] - rank[b.summary.health];
    });

  const q = query.trim().toLowerCase();
  const rows = allRows.filter((r) => {
    if (health !== "all" && r.summary.health !== health) return false;
    if (filterProductId !== "all" && r.batch.productId !== filterProductId) return false;
    if (onlyBlocked && r.summary.blockers.length === 0) return false;
    if (!q) return true;
    return (
      r.batch.number.toLowerCase().includes(q) ||
      (r.product?.name ?? "").toLowerCase().includes(q) ||
      r.summary.primaryBlockingReason.toLowerCase().includes(q)
    );
  });

  const blocked = rows.filter((r) => r.summary.blockers.length > 0).length;
  const late = rows.filter((r) => r.summary.health === "late").length;

  const selectCls =
    "rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground";

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Производство</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} партий в работе · {blocked} с блокерами · {late} с отставанием
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={selectCls}
            aria-label="Изделие для новой партии"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.version}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!productId}
            onClick={() => {
              const id = addBatch(productId);
              navigate({ to: "/batches/$batchId", params: { batchId: id } });
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Новая партия
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: партия, изделие, блокер…"
            className={`${selectCls} w-64 pl-7`}
          />
        </div>
        <select
          value={filterProductId}
          onChange={(e) => setFilterProductId(e.target.value)}
          className={selectCls}
          aria-label="Фильтр по изделию"
        >
          <option value="all">Все изделия</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={health}
          onChange={(e) => setHealth(e.target.value as "all" | BatchHealth)}
          className={selectCls}
          aria-label="Фильтр по статусу"
        >
          <option value="all">Любой статус</option>
          <option value="late">Отставание</option>
          <option value="risk">Риск</option>
          <option value="ok">В графике</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyBlocked}
            onChange={(e) => setOnlyBlocked(e.target.checked)}
          />
          только с блокерами
        </label>
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <BatchCard
            key={r.batch.id}
            batch={r.batch}
            summary={r.summary}
            productName={r.product?.name ?? "—"}
          />
        ))}
        {rows.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Партии не найдены — измените поиск или фильтры.
          </div>
        )}
      </div>

    </div>
  );
}
