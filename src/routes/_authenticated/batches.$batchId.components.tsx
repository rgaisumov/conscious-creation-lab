import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useWorkspace } from "@/lib/production/workspace";
import { useProduction } from "@/lib/production/store";
import { componentUnitsAvailable } from "@/lib/production/calculator";
import { AVAILABILITY_DOT, fmtQty } from "@/components/batch/status";
import type { ComponentType } from "@/lib/production/types";

export const Route = createFileRoute("/_authenticated/batches/$batchId/components")({
  component: ComponentsPage,
});

const TYPE_LABEL: Record<ComponentType, string> = {
  material: "Материалы",
  eri: "ЭРИ",
  fixture: "Оснастка",
  "semi-product": "Полуфабрикаты",
};

function ComponentsPage() {
  const { product, summary, select, selection } = useWorkspace();
  const { updatePosition, updateFixtureCount } = useProduction();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const rows = product.components
    .map((c) => {
      const units = componentUnitsAvailable(c);
      const availability = units >= summary.batchSize ? "full" : units > 0 ? "partial" : "none";
      return { c, units, availability } as const;
    })
    .sort((a, b) => {
      const rank = { none: 0, partial: 1, full: 2 } as const;
      return rank[a.availability] - rank[b.availability];
    });

  return (
    <div className="p-6 space-y-2">
      <p className="mb-2 text-xs text-muted-foreground">
        Красный — не хватает совсем, жёлтый — хватит на часть партии ({summary.batchSize} шт), зелёный — хватает
        на всю партию. Оснастка не расходуется.
      </p>

      {rows.map(({ c, units, availability }) => {
        const expanded = open[c.id] ?? false;
        const selected = selection?.kind === "component" && selection.id === c.id;
        return (
          <div
            key={c.id}
            className={`rounded-lg border bg-card ${selected ? "border-primary" : "border-border"}`}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setOpen((s) => ({ ...s, [c.id]: !expanded }))}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Развернуть"
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${AVAILABILITY_DOT[availability]}`} />
              <button
                type="button"
                onClick={() => select({ kind: "component", id: c.id })}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-sm font-medium text-card-foreground">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {TYPE_LABEL[c.type]} · хватает на {fmtQty(units)}/{summary.batchSize} шт
                </div>
              </button>

              {c.type === "fixture" && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  в наличии
                  <input
                    type="number"
                    min={0}
                    value={c.fixtureCount ?? 0}
                    onChange={(e) => updateFixtureCount(product.id, c.id, Number(e.target.value))}
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-right text-xs text-foreground"
                  />
                </label>
              )}
            </div>

            {expanded && c.positions.length > 0 && (
              <div className="border-t border-border px-4 py-3">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="pb-2 font-normal">Позиция</th>
                      <th className="pb-2 font-normal">Запас</th>
                      <th className="pb-2 font-normal">Норма/шт</th>
                      <th className="pb-2 font-normal">Поставка, дн</th>
                      <th className="pb-2 font-normal">Поставщик</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.positions.map((p) => (
                      <tr key={p.id} className="border-t border-border/60">
                        <td className="py-1.5 pr-2 text-foreground">{p.name}</td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            min={0}
                            value={p.stock}
                            onChange={(e) =>
                              updatePosition(product.id, c.id, p.id, { stock: Number(e.target.value) })
                            }
                            className="w-20 rounded border border-border bg-background px-2 py-1 text-right"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            min={0}
                            value={p.quantityPerUnit}
                            onChange={(e) =>
                              updatePosition(product.id, c.id, p.id, {
                                quantityPerUnit: Number(e.target.value),
                              })
                            }
                            className="w-16 rounded border border-border bg-background px-2 py-1 text-right"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            min={0}
                            value={p.leadTimeDays}
                            onChange={(e) =>
                              updatePosition(product.id, c.id, p.id, {
                                leadTimeDays: Number(e.target.value),
                              })
                            }
                            className="w-16 rounded border border-border bg-background px-2 py-1 text-right"
                          />
                        </td>
                        <td className="py-1.5 text-muted-foreground">{p.supplier ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {expanded && c.positions.length === 0 && (
              <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                {c.type === "semi-product"
                  ? "Полуфабрикат создаётся предыдущей операцией маршрута."
                  : "Позиций нет."}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
