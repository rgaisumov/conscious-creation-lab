import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useProduction } from "@/lib/production/store";
import type { ComponentType } from "@/lib/production/types";

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

function ComponentsPage() {
  const { product } = useProduction();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const visible = product.components.filter((c) => c.type !== "semi-product");

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 max-w-4xl">
        <h1 className="text-lg font-semibold mb-1">Компоненты</h1>
        <p className="text-xs text-muted-foreground mb-4">
          Все компоненты партии. Группы (ЭРИ, Материалы, Детали) раскрываются в состав.
        </p>
        <div className="space-y-2">
          {visible.map((c) => {
            const isOpen = open[c.id];
            const canOpen = c.positions.length > 1;
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
                  <div className="flex-1">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.type === "fixture"
                        ? `Комплектов в наличии: ${c.fixtureCount ?? 0}`
                        : c.positions.length > 1
                          ? `Группа · позиций: ${c.positions.length}`
                          : c.positions[0]
                            ? `${c.positions[0].stock} шт · ${c.positions[0].quantityPerUnit}/изд.`
                            : "—"}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[c.type]}</Badge>
                </button>
                {isOpen && canOpen && (
                  <div className="border-t border-border px-4 py-3 space-y-1.5">
                    {c.positions.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <div>{p.name}</div>
                        <div className={cn("tabular-nums text-muted-foreground")}>
                          {p.stock} шт · {p.quantityPerUnit}/изд. · срок {p.leadTimeDays} дн
                        </div>
                      </div>
                    ))}
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
