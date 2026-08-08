import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, RotateCcw } from "lucide-react";
import { useWorkspace } from "@/lib/production/workspace";
import { useProduction } from "@/lib/production/store";
import { RouteEditor } from "@/components/route/RouteEditor";
import { AVAILABILITY_DOT, AVAILABILITY_RANK, STATUS_META, fmtQty } from "@/components/batch/status";
import type { OperationComputed } from "@/lib/production/types";

export const Route = createFileRoute("/_authenticated/batches/$batchId/")({
  component: TechRoutePage,
});

function TechRoutePage() {
  const { product, batch, summary, selection, select } = useWorkspace();
  const { resetBatchRoute, workcenters } = useProduction();
  const placeOf = (op: { workcenterId?: string | null; outsourceOrg?: string; outsourceDays?: number }) =>
    op.outsourceOrg?.trim()
      ? `Аутсорс · ${op.outsourceOrg}${op.outsourceDays ? ` · ${op.outsourceDays} дн` : ""}`
      : (workcenters.find((w) => w.id === op.workcenterId)?.name ?? "");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);

  const sorted = [...product.operations].sort((a, b) => a.order - b.order);
  const computedById = new Map(summary.operations.map((o) => [o.operationId, o]));
  const opById = new Map(product.operations.map((o) => [o.id, o]));

  type Item = { kind: "op"; opId: string } | { kind: "group"; groupId: string };
  const items: Item[] = [];
  const seenGroups = new Set<string>();
  for (const op of sorted) {
    if (op.groupId) {
      if (seenGroups.has(op.groupId)) continue;
      seenGroups.add(op.groupId);
      items.push({ kind: "group", groupId: op.groupId });
    } else {
      items.push({ kind: "op", opId: op.id });
    }
  }

  const editBar = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
          editing ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        <Pencil className="h-3.5 w-3.5" />
        {editing ? "Готово" : "Редактировать маршрут"}
      </button>
      {batch.routeOverride && (
        <>
          <span className="text-[11px] text-muted-foreground">
            маршрут изменён только для этой партии
          </span>
          <button
            type="button"
            onClick={() => resetBatchRoute(batch.id)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> вернуть маршрут изделия
          </button>
        </>
      )}
    </div>
  );

  if (editing) {
    return (
      <div className="p-6">
        {editBar}
        <RouteEditor target={{ kind: "batch", batchId: batch.id }} />
      </div>
    );
  }

  return (
    <div className="p-6">
      {editBar}
      <div className="rounded-lg border border-border bg-card/40">
        <div className="border-b border-border px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Технологический маршрут
        </div>


        <div className="p-3">
          {items.map((item, idx) => {
            if (item.kind === "op") {
              const oc = computedById.get(item.opId);
              const op = opById.get(item.opId);
              if (!oc || !op) return null;
              return (
                <div key={item.opId}>
                  <OperationRow
                    index={idx + 1}
                    name={op.name}
                    responsible={op.responsible}
                    place={placeOf(op)}
                    outsourced={!!op.outsourceOrg?.trim()}
                    durationHours={op.durationHours}
                    oc={oc}
                    batchSize={summary.batchSize}
                    active={selection?.kind === "operation" && selection.id === op.id}
                    onSelect={() => select({ kind: "operation", id: op.id })}
                    onSelectComponent={(id) => select({ kind: "component", id })}
                  />
                  {idx < items.length - 1 && <Connector />}
                </div>
              );
            }

            const g = summary.groups.find((x) => x.groupId === item.groupId);
            if (!g) return null;
            const open = openGroups[g.groupId] ?? false;
            const meta = STATUS_META[g.status];
            return (
              <div key={g.groupId}>
                <div className={`rounded-md border border-l-2 border-border bg-card ${meta.ring}`}>
                  <button
                    type="button"
                    onClick={() => setOpenGroups((s) => ({ ...s, [g.groupId]: !open }))}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
                    <span className="flex-1 text-sm font-medium text-card-foreground">
                      {g.name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {g.operationIds.length} операций
                      </span>
                    </span>
                    <span className={`rounded border px-2 py-0.5 text-[10px] uppercase ${meta.badge}`}>
                      {meta.short}
                    </span>
                  </button>
                  {open && (
                    <div className="space-y-2 border-t border-border p-2">
                      {g.operationIds.map((opId, i) => {
                        const oc = computedById.get(opId);
                        const op = opById.get(opId);
                        if (!oc || !op) return null;
                        return (
                          <OperationRow
                            key={opId}
                            index={`${idx + 1}.${i + 1}`}
                            name={op.name}
                            responsible={op.responsible}
                            place={placeOf(op)}
                            outsourced={!!op.outsourceOrg?.trim()}
                            durationHours={op.durationHours}
                            oc={oc}
                            batchSize={summary.batchSize}
                            active={selection?.kind === "operation" && selection.id === op.id}
                            onSelect={() => select({ kind: "operation", id: op.id })}
                            onSelectComponent={(id) => select({ kind: "component", id })}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
                {idx < items.length - 1 && <Connector />}
              </div>
            );
          })}
        </div>

        <Legend />
      </div>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex h-6 items-center justify-center">
      <span className="text-sm leading-none text-muted-foreground">↓</span>
    </div>
  );
}

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-sm bg-muted">
      <div className={`h-full ${className}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function OperationRow({
  index,
  name,
  responsible,
  place,
  outsourced,
  durationHours,
  oc,
  batchSize,
  active,
  onSelect,
  onSelectComponent,
}: {
  index: number | string;
  name: string;
  responsible: string;
  place?: string;
  outsourced?: boolean;
  durationHours: number;
  oc: OperationComputed;
  batchSize: number;
  active: boolean;
  onSelect: () => void;
  onSelectComponent: (id: string) => void;
}) {
  const meta = STATUS_META[oc.status];
  const donePct = batchSize > 0 ? (oc.completed / batchSize) * 100 : 0;
  const canDo = Number.isFinite(oc.canPerformNow) ? oc.canPerformNow : batchSize;
  const canPct = batchSize > 0 ? (canDo / batchSize) * 100 : 0;
  const highlight = oc.status === "blocked" || oc.status === "next" || oc.status === "waiting";

  // Полуфабрикаты не отображаем: их наличие = число выполненных операций-изготовителей.
  const reqs = [...oc.requirements]
    .filter((r) => r.type !== "semi-product")
    .sort((a, b) => AVAILABILITY_RANK[a.availability] - AVAILABILITY_RANK[b.availability]);
  const okCount = reqs.filter((r) => r.availability === "full").length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={`grid cursor-pointer grid-cols-1 overflow-hidden rounded-md border transition-colors md:grid-cols-[1.1fr_1.2fr_1.6fr_auto] ${
        active
          ? "border-primary"
          : highlight
            ? `${meta.ring.replace("border-l-", "border-")} hover:border-primary/50`
            : "border-border hover:border-primary/40"
      } bg-card`}
    >
      {/* Колонка 1 — операция */}
      <div className="flex gap-3 p-4 md:border-r md:border-border">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border text-[11px] tabular-nums ${meta.badge}`}
        >
          {index}
        </span>
        <div className="min-w-0">
          <div className={`text-sm font-medium ${highlight ? "text-card-foreground" : "text-card-foreground"}`}>
            {name}
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">{responsible}</div>
          {place && (
            <div
              className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[11px] ${
                outsourced
                  ? "border-status-wait/40 bg-status-wait/10 text-status-wait"
                  : "border-border text-muted-foreground"
              }`}
            >
              {place}
            </div>
          )}
          <div className="text-xs text-muted-foreground">время операции: {durationHours} ч</div>
        </div>
      </div>

      {/* Колонка 2 — прогресс */}
      <div className="space-y-2.5 p-4 md:border-r md:border-border">
        <div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Выполнено</span>
            <span className="tabular-nums text-card-foreground">
              {oc.completed} / {batchSize}
            </span>
          </div>
          <div className="mt-1.5">
            <Bar pct={donePct} className={meta.bar} />
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Можно выполнить</span>
            <span className="tabular-nums text-card-foreground">
              {fmtQty(oc.canPerformNow)} / {batchSize}
            </span>
          </div>
          <div className="mt-1.5">
            <Bar pct={canPct} className={meta.bar} />
          </div>
        </div>
      </div>

      {/* Колонка 3 — требуется для запуска */}
      <div className="p-4 md:border-r md:border-border">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Требуется для запуска ({okCount} из {reqs.length})
        </div>
        <div className="mt-2 space-y-1.5">
          {reqs.length === 0 && <div className="text-xs text-muted-foreground">— закупаемых компонентов нет</div>}
          {reqs.map((r) => (
            <button
              key={r.componentId}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectComponent(r.componentId);
              }}
              className="flex w-full items-center gap-2 text-left text-xs hover:opacity-80"
            >
              <span className="min-w-0 flex-1 truncate text-card-foreground">{r.componentName}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {fmtQty(r.available)} / {fmtQty(r.required)}
              </span>
              <span className={`h-2 w-2 shrink-0 rounded-full ${AVAILABILITY_DOT[r.availability]}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Колонка 4 — статус */}
      <div className="flex min-w-44 flex-col items-start gap-1.5 p-4 md:items-end md:text-right">
        <span className={`rounded border px-2 py-0.5 text-[10px] font-medium uppercase ${meta.badge}`}>
          {meta.short}
        </span>
        <div className="text-xs text-muted-foreground">{oc.reason}</div>
      </div>
    </div>
  );
}

function Legend() {
  const order = ["blocked", "next", "waiting", "ready", "running", "done"] as const;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
      <span className="uppercase tracking-wider">Легенда:</span>
      {order.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${STATUS_META[k].dot}`} />
          {STATUS_META[k].short}
        </span>
      ))}
    </div>
  );
}
