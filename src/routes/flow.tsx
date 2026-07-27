import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronDown,
  AlertTriangle,
  Clock,
  CheckCircle2,
  User,
  Timer,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useProduction } from "@/lib/production/store";
import type {
  Operation,
  OperationComputed,
  OperationVisualStatus,
  Product,
} from "@/lib/production/types";

export const Route = createFileRoute("/flow")({
  head: () => ({
    meta: [
      { title: "Тех.маршрут — Изделие №1" },
      { name: "description", content: "Технологический маршрут партии: операции, блокеры, требования." },
      { property: "og:title", content: "Тех.маршрут" },
      { property: "og:description", content: "Что сейчас ограничивает выпуск партии." },
    ],
  }),
  component: FlowPage,
});

const STATUS_META: Record<
  OperationVisualStatus,
  { label: string; dot: string; bar: string; badge: string; ring: string }
> = {
  blocked: {
    label: "БЛОКИРУЕТ ВЫПУСК",
    dot: "bg-status-block",
    bar: "bg-status-block",
    badge: "bg-status-block/15 text-status-block border-status-block/40",
    ring: "border-l-status-block",
  },
  next: {
    label: "СЛЕДУЮЩАЯ ПРОБЛЕМА",
    dot: "bg-status-next",
    bar: "bg-status-next",
    badge: "bg-status-next/15 text-status-next border-status-next/40",
    ring: "border-l-status-next",
  },
  waiting: {
    label: "ЖДЁТ ПРЕДЫДУЩУЮ",
    dot: "bg-status-wait",
    bar: "bg-status-wait",
    badge: "bg-status-wait/15 text-status-wait border-status-wait/40",
    ring: "border-l-status-wait",
  },
  ready: {
    label: "ГОТОВА К ЗАПУСКУ",
    dot: "bg-status-ready",
    bar: "bg-status-ready",
    badge: "bg-status-ready/15 text-foreground border-status-ready/40",
    ring: "border-l-status-ready",
  },
  running: {
    label: "ВЫПОЛНЯЕТСЯ",
    dot: "bg-status-run",
    bar: "bg-status-run",
    badge: "bg-status-run/15 text-status-run border-status-run/40",
    ring: "border-l-status-run",
  },
  done: {
    label: "ЗАВЕРШЕНА",
    dot: "bg-status-done",
    bar: "bg-status-done",
    badge: "bg-status-done/15 text-status-done border-status-done/40",
    ring: "border-l-status-done",
  },
};

function FlowPage() {
  const { product, summary, updateOperation } = useProduction();
  const [selectedOpId, setSelectedOpId] = useState<string>(product.operations[1]?.id ?? "");
  const [showSemiProducts, setShowSemiProducts] = useState(false);
  const [showRequirements, setShowRequirements] = useState(true);

  const selectedComputed =
    summary.operations.find((o) => o.operationId === selectedOpId) ?? summary.operations[0];
  const selectedOp = product.operations.find((o) => o.id === selectedComputed?.operationId);

  return (
    <div className="flex flex-1 min-w-0 flex-col">
      <div className="flex-1 flex min-h-0">
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-lg font-semibold">Технологический маршрут</h1>
                <p className="text-xs text-muted-foreground">
                  Партия {product.batchSize} шт · {product.operations.length} операций
                </p>
              </div>
            </div>

            {summary.operations.map((oc, idx, arr) => {
              const op = product.operations.find((o) => o.id === oc.operationId)!;
              return (
                <div key={op.id}>
                  <OperationRow
                    index={idx + 1}
                    operation={op}
                    computed={oc}
                    batchSize={product.batchSize}
                    selected={selectedOpId === op.id}
                    showRequirements={showRequirements}
                    showSemiProducts={showSemiProducts}
                    onSelect={() => setSelectedOpId(op.id)}
                  />
                  {idx < arr.length - 1 && (
                    <div className="flex justify-center my-1 text-muted-foreground/40">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {selectedComputed && selectedOp && (
          <DetailsPanel
            product={product}
            operation={selectedOp}
            computed={selectedComputed}
            onClose={() => setSelectedOpId("")}
            onChangeCompleted={(n) => updateOperation(selectedOp.id, { completedUnits: n })}
          />
        )}
      </div>

      <LegendBar
        showRequirements={showRequirements}
        setShowRequirements={setShowRequirements}
        showSemiProducts={showSemiProducts}
        setShowSemiProducts={setShowSemiProducts}
      />
    </div>
  );
}

function OperationRow({
  index,
  operation,
  computed,
  batchSize,
  selected,
  showRequirements,
  showSemiProducts,
  onSelect,
}: {
  index: number;
  operation: Operation;
  computed: OperationComputed;
  batchSize: number;
  selected: boolean;
  showRequirements: boolean;
  showSemiProducts: boolean;
  onSelect: () => void;
}) {
  const meta = STATUS_META[computed.status];
  const completedPct = batchSize > 0 ? (computed.completed / batchSize) * 100 : 0;
  const canPct = batchSize > 0 ? ((computed.completed + computed.canPerformNow) / batchSize) * 100 : 0;
  const rank: Record<string, number> = { none: 0, partial: 1, full: 2 };
  const visibleReqs = computed.requirements
    .filter((r) => (showSemiProducts ? true : r.type !== "semi-product"))
    .slice()
    .sort((a, b) => rank[a.availability] - rank[b.availability]);
  const okCount = visibleReqs.filter((r) => r.availability === "full").length;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-lg border bg-card border-l-4 transition-all",
        meta.ring,
        "border-border",
        selected ? "ring-2 ring-primary/50 shadow-lg" : "hover:bg-card/80",
      )}
    >
      <div className="flex items-stretch gap-4 p-4">
        <div className="w-56 shrink-0">
          <div className="flex items-center gap-2">
            <div className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
            <div className="text-sm font-semibold">
              {index}. {operation.name}
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
            <User className="h-3 w-3" />
            {operation.responsible}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Timer className="h-3 w-3" />
            {operation.durationHours} ч на партию
          </div>
        </div>

        <div className="flex-1 min-w-[180px] space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-muted-foreground">Выполнено</span>
              <span className="font-medium">{computed.completed} / {batchSize}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-status-done" style={{ width: `${completedPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-muted-foreground">Можно выполнить</span>
              <span className="font-medium">+{computed.canPerformNow}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden relative">
              <div className="h-full bg-status-done/60 absolute left-0 top-0" style={{ width: `${completedPct}%` }} />
              <div className={cn("h-full absolute left-0 top-0", meta.bar, "opacity-60")} style={{ width: `${canPct}%` }} />
            </div>
          </div>
        </div>

        {showRequirements && visibleReqs.length > 0 && (
          <div className="w-64 shrink-0">
            <div className="text-xs text-muted-foreground mb-1">
              Требуется ({okCount}/{visibleReqs.length})
            </div>
            <div className="space-y-1">
              {visibleReqs.slice(0, 5).map((r) => {
                const dot =
                  r.availability === "full"
                    ? "bg-status-done"
                    : r.availability === "partial"
                    ? "bg-status-wait"
                    : "bg-status-block";
                const txt =
                  r.availability === "full"
                    ? ""
                    : r.availability === "partial"
                    ? "text-status-wait font-medium"
                    : "text-status-block font-medium";
                return (
                  <div key={r.componentId} className="flex items-center gap-2 text-xs">
                    <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", dot)} />
                    <span className="flex-1 truncate">{r.componentName}</span>
                    <span className={cn("tabular-nums", txt)}>
                      {Number.isFinite(r.available) ? r.available : "∞"}/{r.required}
                    </span>
                  </div>
                );
              })}
              {visibleReqs.length > 5 && (
                <div className="text-xs text-muted-foreground">+{visibleReqs.length - 5}…</div>
              )}
            </div>
          </div>
        )}

        <div className="w-44 shrink-0 flex flex-col items-end justify-between">
          <Badge variant="outline" className={cn("text-[10px] font-semibold", meta.badge)}>
            {meta.label}
          </Badge>
          <div className="text-xs text-muted-foreground text-right mt-2 line-clamp-2">{computed.reason}</div>
        </div>
      </div>
    </button>
  );
}

function DetailsPanel({
  product,
  operation,
  computed,
  onClose,
  onChangeCompleted,
}: {
  product: Product;
  operation: Operation;
  computed: OperationComputed;
  onClose: () => void;
  onChangeCompleted: (n: number) => void;
}) {
  const meta = STATUS_META[computed.status];
  return (
    <aside className="w-96 shrink-0 border-l border-border bg-card overflow-y-auto">
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Операция {operation.order}</div>
            <h2 className="text-lg font-semibold mt-0.5">{operation.name}</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Badge variant="outline" className={cn("mt-3 text-[10px] font-semibold", meta.badge)}>
          {meta.label}
        </Badge>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Ответственный</div>
            <div>{operation.responsible}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Время</div>
            <div>{operation.durationHours} ч</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Можно выполнить</div>
            <div className="font-semibold">{computed.canPerformNow}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Выполнено</div>
            <div className="font-semibold">{computed.completed} / {product.batchSize}</div>
          </div>
        </div>

        {operation.note && (
          <div className="text-sm rounded-md bg-muted/50 p-3 text-muted-foreground">{operation.note}</div>
        )}

        <div>
          <Label className="text-xs text-muted-foreground">Отметить выполнено (шт)</Label>
          <Input
            type="number"
            value={operation.completedUnits}
            onChange={(e) => onChangeCompleted(Math.max(0, Math.min(product.batchSize, Number(e.target.value))))}
            className="mt-1"
          />
        </div>

        {computed.shortages.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-4 w-4 text-status-block" />
              Почему нельзя запустить
            </h3>
            <div className="space-y-2">
              {computed.shortages.map((s) => (
                <div
                  key={s.componentId}
                  className="rounded-md border border-status-block/40 bg-status-block/5 p-3 text-sm"
                >
                  <div className="font-medium">{s.componentName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    доступно {s.available} · нужно {s.required} · нехватка{" "}
                    <span className="text-status-block font-medium">{s.required - s.available}</span>
                  </div>
                  {s.leadTimeDays > 0 && (
                    <div className="text-xs text-muted-foreground">срок поставки: {s.leadTimeDays} дн</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {computed.waitingFor && (
          <div className="rounded-md border border-status-wait/40 bg-status-wait/5 p-3 text-sm">
            <div className="flex items-center gap-1.5 font-medium">
              <Clock className="h-4 w-4 text-status-wait" />
              Ждёт: {computed.waitingFor.operationName}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              не хватает результатов предыдущей операции: {computed.waitingFor.missing} шт
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold mb-2">Требуется для запуска</h3>
          <div className="space-y-1.5">
            {[...computed.requirements]
              .sort(
                (a, b) =>
                  ({ none: 0, partial: 1, full: 2 })[a.availability] -
                  ({ none: 0, partial: 1, full: 2 })[b.availability],
              )
              .map((r) => {
                const dot =
                  r.availability === "full"
                    ? "bg-status-done"
                    : r.availability === "partial"
                    ? "bg-status-wait"
                    : "bg-status-block";
                const txt =
                  r.availability === "full"
                    ? ""
                    : r.availability === "partial"
                    ? "text-status-wait font-medium"
                    : "text-status-block font-medium";
                return (
                  <div key={r.componentId} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded bg-muted/40">
                    <div className={cn("h-2 w-2 rounded-full shrink-0", dot)} />
                    <span className="flex-1 truncate">{r.componentName}</span>
                    <span className={cn("text-xs tabular-nums", txt)}>
                      {Number.isFinite(r.available) ? r.available : "∞"}/{r.required}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>


        {computed.status === "done" && (
          <div className="flex items-center gap-2 text-sm text-status-done">
            <CheckCircle2 className="h-4 w-4" />
            Операция завершена по всей партии
          </div>
        )}
      </div>
    </aside>
  );
}

function LegendBar({
  showRequirements,
  setShowRequirements,
  showSemiProducts,
  setShowSemiProducts,
}: {
  showRequirements: boolean;
  setShowRequirements: (v: boolean) => void;
  showSemiProducts: boolean;
  setShowSemiProducts: (v: boolean) => void;
}) {
  const items = [
    { label: "Блокирует", color: "bg-status-block" },
    { label: "Следующая проблема", color: "bg-status-next" },
    { label: "Ждёт предыдущую", color: "bg-status-wait" },
    { label: "Готова", color: "bg-status-ready" },
    { label: "Выполняется", color: "bg-status-run" },
    { label: "Завершена", color: "bg-status-done" },
  ];
  return (
    <footer className="border-t border-border bg-card px-6 py-3 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-4 flex-wrap">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={cn("h-2 w-2 rounded-full", it.color)} />
            {it.label}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={showRequirements} onCheckedChange={setShowRequirements} />
          Компоненты в карточках
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={showSemiProducts} onCheckedChange={setShowSemiProducts} />
          Полуфабрикаты
        </label>
      </div>
    </footer>
  );
}
