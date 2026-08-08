import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { useWorkspace } from "@/lib/production/workspace";
import { useProduction } from "@/lib/production/store";
import { GraphEditor } from "@/components/route/GraphEditor";
import { componentUnitsAvailable } from "@/lib/production/calculator";
import { AVAILABILITY_DOT, STATUS_META, fmtQty } from "@/components/batch/status";
import type { ComponentType } from "@/lib/production/types";

export const Route = createFileRoute("/_authenticated/batches/$batchId/graph")({
  component: GraphPage,
});

const TYPE_LABEL: Record<ComponentType, string> = {
  material: "Материал",
  eri: "ЭРИ",
  fixture: "Оснастка",
  "semi-product": "Полуфабрикат",
};

function GraphPage() {
  const { product, batch, summary, selection, select } = useWorkspace();
  const { resetBatchRoute } = useProduction();
  const [editing, setEditing] = useState(false);
  const sorted = [...product.operations].sort((a, b) => a.order - b.order);
  const computedById = new Map(summary.operations.map((o) => [o.operationId, o]));
  const compById = new Map(product.components.map((c) => [c.id, c]));
  /** operationId that produces a given component */
  const producerOpByComponent = new Map<string, string>();
  for (const op of sorted) if (op.outputComponentId) producerOpByComponent.set(op.outputComponentId, op.id);

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
        {editing ? "Готово" : "Редактировать граф"}
      </button>
      {batch.routeOverride && (
        <>
          <span className="text-[11px] text-muted-foreground">граф изменён только для этой партии</span>
          <button
            type="button"
            onClick={() => resetBatchRoute(batch.id)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> вернуть граф изделия
          </button>
        </>
      )}
    </div>
  );

  if (editing) {
    return (
      <div className="p-6">
        {editBar}
        <GraphEditor target={{ kind: "batch", batchId: batch.id }} />
      </div>
    );
  }

  return (
    <div className="p-6">
      {editBar}
      <p className="mb-4 text-xs text-muted-foreground">
        Граф изделия: слева все закупаемые компоненты операции, справа результат. Полуфабрикаты не показываются
        отдельными карточками — вместо них вертикальная стрелка от операции-изготовителя к операции-потребителю.
        Выделение синхронизировано с тех.маршрутом.
      </p>


      <div className="space-y-1">
        {sorted.map((op, i) => {
          const oc = computedById.get(op.id);
          if (!oc) return null;
          const meta = STATUS_META[oc.status];
          const outputRaw = op.outputComponentId ? compById.get(op.outputComponentId) : undefined;
          const output = outputRaw && outputRaw.type !== "semi-product" ? outputRaw : undefined;
          const active = selection?.kind === "operation" && selection.id === op.id;

          const materialInputs = op.inputComponentIds.filter(
            (cid) => compById.get(cid)?.type !== "semi-product",
          );
          const semiProducerIds = op.inputComponentIds
            .map((cid) => compById.get(cid))
            .filter((c) => c && c.type === "semi-product")
            .map((c) => producerOpByComponent.get(c!.id))
            .filter((id): id is string => !!id);
          const hasIncomingSemi = semiProducerIds.length > 0;

          return (
            <div key={op.id}>
              {hasIncomingSemi && i > 0 && (
                <div className="flex items-stretch gap-3">
                  <div className="w-64 shrink-0" />
                  <div className="w-6 shrink-0" />
                  <div className="min-w-56 flex-1">
                    <div className="flex h-8 items-center justify-center text-muted-foreground">
                      <span className="text-lg leading-none">↓</span>
                    </div>
                  </div>
                  <div className="w-4 shrink-0" />
                  <div className="w-52 shrink-0" />
                </div>
              )}

              <div className="flex flex-wrap items-stretch gap-3">
                <div className="flex w-64 shrink-0 flex-col gap-1.5">
                  {materialInputs.map((cid) => {
                    const c = compById.get(cid);
                    if (!c) return null;
                    const units = componentUnitsAvailable(c);
                    const av = units >= summary.batchSize ? "full" : units > 0 ? "partial" : "none";
                    const selected = selection?.kind === "component" && selection.id === c.id;
                    return (
                      <button
                        key={cid}
                        type="button"
                        onClick={() => select({ kind: "component", id: c.id })}
                        className={`flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-left text-xs transition-colors ${
                          selected ? "border-primary" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${AVAILABILITY_DOT[av]}`} />
                        <span className="min-w-0 flex-1 truncate text-card-foreground">{c.name}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{TYPE_LABEL[c.type]}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex w-6 shrink-0 items-center justify-center text-muted-foreground">
                  {materialInputs.length > 0 ? "→" : ""}
                </div>

                <button
                  type="button"
                  onClick={() => select({ kind: "operation", id: op.id })}
                  className={`min-w-56 flex-1 rounded-lg border border-l-4 bg-card p-3 text-left transition-colors ${meta.ring} ${
                    active ? "border-primary" : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="text-sm font-medium text-card-foreground">{op.name}</span>
                    <span className={`ml-auto rounded border px-2 py-0.5 text-[11px] ${meta.badge}`}>
                      {meta.short}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {oc.completed}/{summary.batchSize} шт · можно сейчас {fmtQty(oc.canPerformNow)}
                  </div>
                </button>

                <div className="flex w-4 shrink-0 items-center text-muted-foreground">{output ? "→" : ""}</div>

                <div className="flex w-52 shrink-0 items-center">
                  {output ? (
                    <button
                      type="button"
                      onClick={() => select({ kind: "component", id: output.id })}
                      className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-left text-xs text-card-foreground hover:border-primary/40"
                    >
                      {output.name}
                      <span className="ml-1 text-[10px] text-muted-foreground">{TYPE_LABEL[output.type]}</span>
                    </button>
                  ) : !op.outputComponentId ? (
                    <div className="w-full rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                      готовое изделие
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

