import { createFileRoute } from "@tanstack/react-router";
import { useWorkspace } from "@/lib/production/workspace";
import { componentUnitsAvailable } from "@/lib/production/calculator";
import { AVAILABILITY_DOT, STATUS_META, fmtQty } from "@/components/batch/status";
import type { ComponentType } from "@/lib/production/types";

export const Route = createFileRoute("/batches/$batchId/graph")({
  component: GraphPage,
});

const TYPE_LABEL: Record<ComponentType, string> = {
  material: "Материал",
  eri: "ЭРИ",
  fixture: "Оснастка",
  "semi-product": "Полуфабрикат",
};

function GraphPage() {
  const { product, summary, selection, select } = useWorkspace();
  const sorted = [...product.operations].sort((a, b) => a.order - b.order);
  const computedById = new Map(summary.operations.map((o) => [o.operationId, o]));
  const compById = new Map(product.components.map((c) => [c.id, c]));
  const indexOfOp = new Map(sorted.map((o, i) => [o.id, i + 1]));
  /** operationId that produces a given component */
  const producerOpByComponent = new Map<string, string>();
  for (const op of sorted) if (op.outputComponentId) producerOpByComponent.set(op.outputComponentId, op.id);
  /** first operation that consumes a given component */
  const consumerOpByComponent = new Map<string, string>();
  for (const op of sorted)
    for (const cid of op.inputComponentIds)
      if (!consumerOpByComponent.has(cid)) consumerOpByComponent.set(cid, op.id);

  return (
    <div className="p-6">
      <p className="mb-4 text-xs text-muted-foreground">
        Граф изделия: слева все закупаемые компоненты операции, справа результат. Полуфабрикаты не показываются
        отдельными карточками — вместо них стрелка от операции-изготовителя. Выделение синхронизировано с тех.маршрутом.
      </p>

      <div className="space-y-4">
        {sorted.map((op, i) => {
          const oc = computedById.get(op.id);
          if (!oc) return null;
          const meta = STATUS_META[oc.status];
          const outputRaw = op.outputComponentId ? compById.get(op.outputComponentId) : undefined;
          const output = outputRaw && outputRaw.type !== "semi-product" ? outputRaw : undefined;
          const outputSemi = outputRaw && outputRaw.type === "semi-product" ? outputRaw : undefined;
          const consumerOpId = outputSemi ? consumerOpByComponent.get(outputSemi.id) : undefined;
          const active = selection?.kind === "operation" && selection.id === op.id;

          const materialInputs = op.inputComponentIds.filter(
            (cid) => compById.get(cid)?.type !== "semi-product",
          );
          const semiSources = op.inputComponentIds
            .map((cid) => compById.get(cid))
            .filter((c) => c && c.type === "semi-product")
            .map((c) => ({ comp: c!, opId: producerOpByComponent.get(c!.id) }))
            .filter((s) => s.opId);

          return (
            <div key={op.id} className="flex flex-wrap items-stretch gap-3">
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
                {materialInputs.length === 0 && (
                  <div className="rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                    без закупаемых компонентов
                  </div>
                )}
              </div>

              <div className="flex flex-col items-start justify-center gap-1 text-muted-foreground">
                <span>→</span>
                {semiSources.map((s) => (
                  <button
                    key={s.comp.id}
                    type="button"
                    onClick={() => select({ kind: "operation", id: s.opId! })}
                    className="whitespace-nowrap rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] hover:border-primary/40 hover:text-foreground"
                    title={s.comp.name}
                  >
                    ↳ из оп. {indexOfOp.get(s.opId!)}
                  </button>
                ))}
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

              <div className="flex items-center text-muted-foreground">→</div>

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
                ) : outputSemi && consumerOpId ? (
                  <button
                    type="button"
                    onClick={() => select({ kind: "operation", id: consumerOpId })}
                    className="w-full rounded-md border border-dashed border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    title={outputSemi.name}
                  >
                    → в оп. {indexOfOp.get(consumerOpId)}
                  </button>
                ) : (
                  <div className="w-full rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                    готовое изделие
                  </div>
                )}
              </div>
            </div>
          );
        })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
