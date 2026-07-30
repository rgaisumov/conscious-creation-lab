import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CalendarClock } from "lucide-react";
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
  const { batches, getProduct, summaryOf } = useProduction();

  const rows = batches
    .map((b) => ({ batch: b, summary: summaryOf(b), product: getProduct(b.productId) }))
    .sort((a, b) => {
      const rank = { late: 0, risk: 1, ok: 2 } as const;
      return rank[a.summary.health] - rank[b.summary.health];
    });

  const blocked = rows.filter((r) => r.summary.blockers.length > 0).length;
  const late = rows.filter((r) => r.summary.health === "late").length;

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Производство</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} партий в работе · {blocked} с блокерами · {late} с отставанием
        </p>
      </header>

      <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <BatchCard
            key={r.batch.id}
            batch={r.batch}
            summary={r.summary}
            productName={r.product?.name ?? "—"}
          />
        ))}
      </div>
    </div>
  );
}
