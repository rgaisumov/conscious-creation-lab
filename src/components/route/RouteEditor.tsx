import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useProduction, type RouteTarget } from "@/lib/production/store";
import * as R from "@/lib/production/route-ops";
import type { ComponentType } from "@/lib/production/types";

export const TYPE_LABEL: Record<ComponentType, string> = {
  material: "Материал",
  eri: "ЭРИ",
  fixture: "Оснастка",
  "semi-product": "Полуфабрикат",
};

/** Shared editor of the technological route (operations + their inputs/outputs). */
export function RouteEditor({ target }: { target: RouteTarget }) {
  const { getRoute, mutateRoute } = useProduction();
  const route = getRoute(target);
  if (!route) return null;

  const ops = R.sortedOps(route);
  const compById = new Map(route.components.map((c) => [c.id, c]));
  const purchasable = route.components.filter((c) => c.type !== "semi-product");

  const InsertRow = ({ index }: { index: number }) => (
    <div className="flex justify-center py-1">
      <button
        type="button"
        onClick={() => mutateRoute(target, (r) => R.addOperation(r, index))}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
      >
        <Plus className="h-3 w-3" /> операция
      </button>
    </div>
  );

  return (
    <div className="space-y-1">
      <InsertRow index={0} />
      {ops.map((op, i) => {
        const prev = ops[i - 1];
        const linkedToPrev =
          !!prev &&
          op.inputComponentIds.some((cid) => {
            const c = compById.get(cid);
            return c?.type === "semi-product" && c.producedByOperationId === prev.id;
          });

        return (
          <div key={op.id}>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded border border-border text-[11px] tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <input
                  value={op.name}
                  onChange={(e) => mutateRoute(target, (r) => R.updateOperation(r, op.id, { name: e.target.value }))}
                  className="min-w-40 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                />
                <input
                  value={op.responsible}
                  onChange={(e) =>
                    mutateRoute(target, (r) => R.updateOperation(r, op.id, { responsible: e.target.value }))
                  }
                  placeholder="Ответственный"
                  className="w-40 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                />
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  ч
                  <input
                    type="number"
                    min={0}
                    value={op.durationHours}
                    onChange={(e) =>
                      mutateRoute(target, (r) =>
                        R.updateOperation(r, op.id, { durationHours: Number(e.target.value) }),
                      )
                    }
                    className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs tabular-nums text-foreground"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => mutateRoute(target, (r) => R.moveOperation(r, op.id, -1))}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Выше"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => mutateRoute(target, (r) => R.moveOperation(r, op.id, 1))}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Ниже"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => mutateRoute(target, (r) => R.removeOperation(r, op.id))}
                  className="rounded p-1 text-muted-foreground hover:text-status-block"
                  aria-label="Удалить операцию"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  Участок
                  <select
                    value={op.workcenterId ?? ""}
                    onChange={(e) =>
                      mutateRoute(target, (r) =>
                        R.updateOperation(r, op.id, { workcenterId: e.target.value || null }),
                      )
                    }
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                  >
                    <option value="">— не задан —</option>
                    {workcenters.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={!!op.outsourceOrg}
                    onChange={(e) =>
                      mutateRoute(target, (r) =>
                        R.updateOperation(r, op.id, {
                          outsourceOrg: e.target.checked ? "Подрядчик" : undefined,
                          outsourceDays: e.target.checked ? (op.outsourceDays ?? 5) : undefined,
                        }),
                      )
                    }
                  />
                  аутсорс
                </label>
                {op.outsourceOrg !== undefined && (
                  <>
                    <input
                      value={op.outsourceOrg}
                      onChange={(e) =>
                        mutateRoute(target, (r) => R.updateOperation(r, op.id, { outsourceOrg: e.target.value }))
                      }
                      placeholder="Организация"
                      className="w-44 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                    />
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      оборот, дн
                      <input
                        type="number"
                        min={0}
                        value={op.outsourceDays ?? 0}
                        onChange={(e) =>
                          mutateRoute(target, (r) =>
                            R.updateOperation(r, op.id, { outsourceDays: Number(e.target.value) }),
                          )
                        }
                        className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs tabular-nums text-foreground"
                      />
                    </label>
                  </>
                )}
                {prev && transitionHours(prev, op) > 0 && (
                  <span className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    транспортировка с предыдущего узла: {transitionHours(prev, op)} ч
                  </span>
                )}
              </div>

              <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                Закупаемые компоненты операции
              </div>

              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {purchasable.map((c) => {
                  const on = op.inputComponentIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => mutateRoute(target, (r) => R.toggleInput(r, op.id, c.id))}
                      className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                        on
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {c.name}
                      <span className="ml-1 opacity-60">{TYPE_LABEL[c.type]}</span>
                    </button>
                  );
                })}
                {purchasable.length === 0 && (
                  <span className="text-xs text-muted-foreground">Компонентов пока нет</span>
                )}
              </div>

              {prev && (
                <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
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
                  использует результат операции {i} «{prev.name}»
                </label>
              )}
            </div>
            <InsertRow index={i + 1} />
          </div>
        );
      })}

      <ComponentsEditor target={target} />
    </div>
  );
}

export function ComponentsEditor({ target }: { target: RouteTarget }) {
  const { getRoute, mutateRoute } = useProduction();
  const route = getRoute(target);
  if (!route) return null;
  const list = route.components.filter((c) => c.type !== "semi-product");

  return (
    <div className="mt-4 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Компоненты изделия
        </span>
        {(["material", "eri", "fixture"] as ComponentType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => mutateRoute(target, (r) => R.addComponent(r, t))}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="h-3 w-3" /> {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="mt-2 space-y-1.5">
        {list.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2">
            <input
              value={c.name}
              onChange={(e) => mutateRoute(target, (r) => R.updateComponent(r, c.id, { name: e.target.value }))}
              className="min-w-48 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            />
            <select
              value={c.type}
              onChange={(e) =>
                mutateRoute(target, (r) => R.updateComponent(r, c.id, { type: e.target.value as ComponentType }))
              }
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            >
              <option value="material">Материал</option>
              <option value="eri">ЭРИ</option>
              <option value="fixture">Оснастка</option>
            </select>
            <button
              type="button"
              onClick={() => mutateRoute(target, (r) => R.removeComponent(r, c.id))}
              className="rounded p-1 text-muted-foreground hover:text-status-block"
              aria-label="Удалить компонент"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {list.length === 0 && <div className="text-xs text-muted-foreground">Компонентов пока нет</div>}
      </div>
    </div>
  );
}
