import { AlertTriangle, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProduction } from "@/lib/production/store";
import type { ReactNode } from "react";

export function BatchStatusBar() {
  const { product, summary, setBatchSize, setShipped } = useProduction();

  return (
    <header className="border-b border-border bg-card px-6 py-4 shrink-0">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-[260px]">
          <div className="text-xs uppercase text-muted-foreground mb-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-status-block" />
            Ограничивают выпуск
          </div>
          {summary.blockers.length === 0 ? (
            <div className="text-sm text-status-done">Блокеров нет — можно вести партию дальше</div>
          ) : (
            <ol className="text-sm space-y-0.5">
              {summary.blockers.map((b, i) => (
                <li key={b.operationId} className="flex gap-2">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <span>
                    <span className="font-medium">{b.operationName}</span>
                    <span className="text-muted-foreground"> — {b.reason}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex gap-3 flex-wrap">
          <MetricTile label="Партия">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setBatchSize(product.batchSize - 10)}>
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                value={product.batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="h-7 w-16 text-center text-base font-semibold"
              />
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setBatchSize(product.batchSize + 10)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">шт</div>
          </MetricTile>
          <MetricTile label="Укомплектовано" tone={summary.equipped < product.batchSize ? "warn" : "ok"}>
            <div className="text-lg font-semibold">
              {summary.equipped} <span className="text-muted-foreground text-sm">/ {product.batchSize}</span>
            </div>
            <MiniBar value={summary.equipped} max={product.batchSize} tone="warn" />
          </MetricTile>
          <MetricTile label="Собрано">
            <div className="text-lg font-semibold">
              {summary.assembled} <span className="text-muted-foreground text-sm">/ {product.batchSize}</span>
            </div>
            <MiniBar value={summary.assembled} max={product.batchSize} tone="run" />
          </MetricTile>
          <MetricTile label="Испытано">
            <div className="text-lg font-semibold">
              {summary.tested} <span className="text-muted-foreground text-sm">/ {product.batchSize}</span>
            </div>
            <MiniBar value={summary.tested} max={product.batchSize} tone="done" />
          </MetricTile>
          <MetricTile label="Отгружено">
            <Input
              type="number"
              value={product.shippedUnits}
              onChange={(e) => setShipped(Number(e.target.value))}
              className="h-7 w-20 text-center text-base font-semibold"
            />
            <div className="text-xs text-muted-foreground mt-0.5">из {product.batchSize}</div>
          </MetricTile>
        </div>
      </div>
    </header>
  );
}

function MetricTile({ label, children, tone }: { label: string; children: ReactNode; tone?: "ok" | "warn" | "danger" }) {
  return (
    <div
      className={cn(
        "rounded-md border bg-background px-3 py-2 min-w-[120px]",
        tone === "warn" && "border-status-wait/40",
        tone === "danger" && "border-status-block/40",
      )}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function MiniBar({ value, max, tone }: { value: number; max: number; tone: "warn" | "run" | "done" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = tone === "warn" ? "bg-status-wait" : tone === "run" ? "bg-status-run" : "bg-status-done";
  return (
    <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
      <div className={cn("h-full", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
