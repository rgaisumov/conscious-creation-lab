import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProduction } from "@/lib/production/store";
import type { ComponentType, OperationVisualStatus } from "@/lib/production/types";

export const Route = createFileRoute("/graph")({
  head: () => ({
    meta: [
      { title: "Граф — Изделие №1" },
      { name: "description", content: "Графовое представление тех.процесса: компоненты и операции." },
      { property: "og:title", content: "Граф процесса" },
      { property: "og:description", content: "Компоненты и операции одной модели производства." },
    ],
  }),
  component: GraphPage,
});

const STATUS_COLOR: Record<OperationVisualStatus, string> = {
  blocked: "border-status-block/60 bg-status-block/10",
  next: "border-status-next/60 bg-status-next/10",
  waiting: "border-status-wait/60 bg-status-wait/10",
  ready: "border-border bg-card",
  running: "border-status-run/60 bg-status-run/10",
  done: "border-status-done/60 bg-status-done/10",
};

const TYPE_LABEL: Record<ComponentType, string> = {
  material: "Материал",
  eri: "ЭРИ",
  fixture: "Оснастка",
  "semi-product": "Полуфабрикат",
};

const TYPE_TONE: Record<ComponentType, string> = {
  material: "bg-blue-500/15 text-blue-400 border-blue-500/40",
  eri: "bg-purple-500/15 text-purple-400 border-purple-500/40",
  fixture: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  "semi-product": "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
};

function GraphPage() {
  const { product, summary } = useProduction();
  const [showSemi, setShowSemi] = useState(false);
  const compById = new Map(product.components.map((c) => [c.id, c]));

  return (
    <div className="flex flex-1 min-w-0 flex-col">
      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold">Граф процесса</h1>
              <p className="text-xs text-muted-foreground">
                Та же модель, что и «Тех.маршрут». Компоненты слева входят в операцию справа.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={showSemi} onCheckedChange={setShowSemi} />
              Показывать полуфабрикаты
            </label>
          </div>

          <div className="space-y-1">
            {summary.operations.map((oc, idx, arr) => {
              const op = product.operations.find((o) => o.id === oc.operationId)!;
              const inputs = op.inputComponentIds
                .map((id) => compById.get(id))
                .filter((c): c is NonNullable<typeof c> => !!c)
                .filter((c) => (showSemi ? true : c.type !== "semi-product"));
              return (
                <div key={op.id}>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {inputs.map((c) => (
                        <div
                          key={c.id}
                          className={cn(
                            "px-2.5 py-1 rounded-md border text-xs flex items-center gap-1.5",
                            TYPE_TONE[c.type],
                          )}
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-[10px] opacity-60">· {TYPE_LABEL[c.type]}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-muted-foreground/50 text-xs">→</div>
                    <div
                      className={cn(
                        "rounded-lg border p-3 max-w-md",
                        STATUS_COLOR[oc.status],
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">
                          {idx + 1}. {op.name}
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {oc.completed}/{product.batchSize}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{oc.reason}</div>
                    </div>
                  </div>
                  {idx < arr.length - 1 && (
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 my-1">
                      <div />
                      <div />
                      <div className="flex justify-start pl-4 text-muted-foreground/40">
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
