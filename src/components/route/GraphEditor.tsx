import { Plus, Trash2, X } from "lucide-react";
import { useProduction, type RouteTarget } from "@/lib/production/store";
import * as R from "@/lib/production/route-ops";
import { TYPE_LABEL, ComponentsEditor } from "./RouteEditor";

/**
 * Graph editor — same model as the route editor, but arranged as
 * «компоненты → операция → результат», with vertical semi-product links.
 */
export function GraphEditor({ target }: { target: RouteTarget }) {
  const { getRoute, mutateRoute } = useProduction();
  const route = getRoute(target);
  if (!route) return null;

  const ops = R.sortedOps(route);
  const compById = new Map(route.components.map((c) => [c.id, c]));
  const purchasable = route.components.filter((c) => c.type !== "semi-product");

  return (
    <div className="space-y-2">
      {ops.map((op, i) => {
        const prev = ops[i - 1];
        const linkedToPrev =
          !!prev &&
          op.inputComponentIds.some((cid) => {
            const c = compById.get(cid);
            return c?.type === "semi-product" && c.producedByOperationId === prev.id;
          });
        const inputs = op.inputComponentIds
          .map((cid) => compById.get(cid))
          .filter((c) => c && c.type !== "semi-product");
        const unused = purchasable.filter((c) => !op.inputComponentIds.includes(c.id));

        return (
          <div key={op.id}>
            {prev && (
              <div className="flex items-center gap-3 py-1">
                <div className="w-64 shrink-0" />
                <div className="w-6 shrink-0" />
                <label className="flex min-w-56 flex-1 items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={linkedToPrev}
                    onChange={(e) =>
                      mutateRoute(target, (r) =>
                        e.target.checked
                          ? R.linkOperations(r, prev.id, op.id)
                          : R.unlinkOperations(r, prev.id, op.id),
                      )
                    }
                  />
                  <span className={linkedToPrev ? "text-foreground" : ""}>
                    {linkedToPrev ? "↓ полуфабрикат из предыдущей операции" : "связать с предыдущей операцией"}
                  </span>
                </label>
                <div className="w-4 shrink-0" />
                <div className="w-52 shrink-0" />
              </div>
            )}

            <div className="flex flex-wrap items-stretch gap-3">
              <div className="flex w-64 shrink-0 flex-col gap-1.5">
                {inputs.map((c) => (
                  <div
                    key={c!.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate text-card-foreground">{c!.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{TYPE_LABEL[c!.type]}</span>
                    <button
                      type="button"
                      onClick={() => mutateRoute(target, (r) => R.toggleInput(r, op.id, c!.id))}
                      className="text-muted-foreground hover:text-status-block"
                      aria-label="Убрать компонент из операции"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {unused.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id) mutateRoute(target, (r) => R.toggleInput(r, op.id, id));
                    }}
                    className="rounded-md border border-dashed border-border bg-background px-2 py-1.5 text-[11px] text-muted-foreground"
                  >
                    <option value="">+ добавить компонент</option>
                    {unused.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex w-6 shrink-0 items-center justify-center text-muted-foreground">
                {inputs.length > 0 ? "→" : ""}
              </div>

              <div className="min-w-56 flex-1 rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                  <input
                    value={op.name}
                    onChange={(e) =>
                      mutateRoute(target, (r) => R.updateOperation(r, op.id, { name: e.target.value }))
                    }
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => mutateRoute(target, (r) => R.removeOperation(r, op.id))}
                    className="text-muted-foreground hover:text-status-block"
                    aria-label="Удалить операцию"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => mutateRoute(target, (r) => R.addOperation(r, i + 1))}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    <Plus className="h-3 w-3" /> операция ниже
                  </button>
                </div>
              </div>

              <div className="flex w-4 shrink-0 items-center text-muted-foreground">→</div>

              <div className="flex w-52 shrink-0 items-center">
                <div className="w-full rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                  {(() => {
                    const out = op.outputComponentId ? compById.get(op.outputComponentId) : undefined;
                    if (out && out.type !== "semi-product") return out.name;
                    if (linkedNext(route, op.id)) return "полуфабрикат → далее";
                    return "готовое изделие";
                  })()}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => mutateRoute(target, (r) => R.addOperation(r, ops.length))}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="h-3 w-3" /> операция в конец
        </button>
      </div>

      <ComponentsEditor target={target} />
    </div>
  );
}

function linkedNext(route: R.RouteDraft, opId: string) {
  const semiIds = route.components
    .filter((c) => c.type === "semi-product" && c.producedByOperationId === opId)
    .map((c) => c.id);
  return route.operations.some((o) => o.inputComponentIds.some((c) => semiIds.includes(c)));
}
