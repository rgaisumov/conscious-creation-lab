import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useProduction } from "@/lib/production/store";
import { componentUnitsAvailable } from "@/lib/production/calculator";
import type { ComponentGroup, ComponentType } from "@/lib/production/types";

export const Route = createFileRoute("/components")({
  head: () => ({
    meta: [
      { title: "Компоненты — Изделие №1" },
      { name: "description", content: "Компоненты, ЭРИ, материалы и оснастка изделия." },
      { property: "og:title", content: "Компоненты" },
      { property: "og:description", content: "Наличие и потребность по компонентам." },
    ],
  }),
  component: ComponentsPage,
});

const TYPE_LABEL: Record<ComponentType, string> = {
  material: "Материал",
  eri: "ЭРИ",
  fixture: "Оснастка",
  "semi-product": "Полуфабрикат",
};

function availabilityFor(c: ComponentGroup, batchSize: number): "full" | "partial" | "none" {
  const av = componentUnitsAvailable(c);
  if (av === Infinity) return c.type === "fixture" ? "full" : "full";
  if (av >= batchSize) return "full";
  if (av > 0) return "partial";
  return "none";
}

function ComponentsPage() {
  const { product, updatePosition, updateFixtureCount } = useProduction();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const visible = product.components.filter((c) => c.type !== "semi-product");

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 max-w-5xl">
        <h1 className="text-lg font-semibold mb-1">Компоненты</h1>
        <p className="text-xs text-muted-foreground mb-4">
          Все компоненты партии. Клик по группе — раскрыть состав. Значения запаса и срока поставки редактируемые.
        </p>
        <div className="space-y-2">
          {visible.map((c) => {
            const isOpen = open[c.id];
            const canOpen = c.positions.length > 0 || c.type === "fixture";
            const status = availabilityFor(c, product.batchSize);
            const av = componentUnitsAvailable(c);
            const availText =
              c.type === "fixture"
                ? `Комплектов: ${c.fixtureCount ?? 0}`
                : av === Infinity
                  ? "∞"
                  : `Хватит на ${av} из ${product.batchSize}`;
            const dot =
              status === "full" ? "bg-status-done" : status === "partial" ? "bg-status-wait" : "bg-status-block";
            const badgeCls =
              status === "full"
                ? "bg-status-done/15 text-status-done border-status-done/40"
                : status === "partial"
                  ? "bg-status-wait/15 text-status-wait border-status-wait/40"
                  : "bg-status-block/15 text-status-block border-status-block/40";
            return (
              <div key={c.id} className="rounded-md border border-border bg-card">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  onClick={() => canOpen && setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                >
                  {canOpen ? (
                    isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <div className="w-4" />
                  )}
                  <div className={cn("h-2 w-2 rounded-full shrink-0", dot)} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{availText}</div>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px]", badgeCls)}>
                    {status === "full" ? "хватает" : status === "partial" ? "частично" : "нет"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[c.type]}</Badge>
                </button>

                {isOpen && c.type === "fixture" && (
                  <div className="border-t border-border px-4 py-3 flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">Комплектов в наличии</span>
                    <Input
                      type="number"
                      value={c.fixtureCount ?? 0}
                      onChange={(e) => updateFixtureCount(c.id, Number(e.target.value))}
                      className="h-7 w-24"
                    />
                  </div>
                )}

                {isOpen && c.type !== "fixture" && c.positions.length > 0 && (
                  <div className="border-t border-border px-4 py-3">
                    <div className="grid grid-cols-[1fr_100px_100px_100px] gap-3 text-[10px] uppercase text-muted-foreground pb-2">
                      <div>Позиция</div>
                      <div className="text-right">Запас</div>
                      <div className="text-right">На изд.</div>
                      <div className="text-right">Срок, дн</div>
                    </div>
                    <div className="space-y-1.5">
                      {c.positions.map((p) => {
                        const need = p.quantityPerUnit * product.batchSize;
                        const shortage = Math.max(0, need - p.stock);
                        return (
                          <div key={p.id} className="grid grid-cols-[1fr_100px_100px_100px] gap-3 items-center text-xs">
                            <div>
                              <div>{p.name}</div>
                              {shortage > 0 && (
                                <div className="text-[10px] text-status-block">
                                  не хватает {shortage} на партию
                                </div>
                              )}
                            </div>
                            <Input
                              type="number"
                              value={p.stock}
                              onChange={(e) => updatePosition(c.id, p.id, { stock: Math.max(0, Number(e.target.value)) })}
                              className="h-7 text-right tabular-nums"
                            />
                            <Input
                              type="number"
                              value={p.quantityPerUnit}
                              onChange={(e) => updatePosition(c.id, p.id, { quantityPerUnit: Math.max(0, Number(e.target.value)) })}
                              className="h-7 text-right tabular-nums"
                            />
                            <Input
                              type="number"
                              value={p.leadTimeDays}
                              onChange={(e) => updatePosition(c.id, p.id, { leadTimeDays: Math.max(0, Number(e.target.value)) })}
                              className="h-7 text-right tabular-nums"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
