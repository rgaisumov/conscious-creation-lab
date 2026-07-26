import { createFileRoute, Link } from "@tanstack/react-router";
import { useProduction } from "@/lib/production/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Workflow } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Изделия — Система управления производством" },
      { name: "description", content: "Список изделий и их партии." },
      { property: "og:title", content: "Изделия" },
      { property: "og:description", content: "Список изделий в производстве." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { product, summary } = useProduction();
  return (
    <ScrollArea className="flex-1">
      <div className="p-6 max-w-4xl">
        <h1 className="text-2xl font-semibold mb-1">Изделия</h1>
        <p className="text-sm text-muted-foreground mb-6">
          MVP: в системе одно активное изделие. Выберите его, чтобы перейти к тех.маршруту.
        </p>

        <Link
          to="/flow"
          className="block rounded-lg border border-border bg-card p-5 hover:bg-card/80 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Workflow className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">{product.name}</h2>
              </div>
              <div className="text-sm text-muted-foreground">
                Партия {product.batchSize} шт · {product.operations.length} операций
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">Укомплектовано {summary.equipped}/{product.batchSize}</Badge>
                <Badge variant="outline">Собрано {summary.assembled}/{product.batchSize}</Badge>
                <Badge variant="outline">Испытано {summary.tested}/{product.batchSize}</Badge>
                <Badge variant="outline">Отгружено {summary.shipped}/{product.batchSize}</Badge>
                {summary.blockers.length > 0 && (
                  <Badge variant="outline" className="bg-status-block/15 text-status-block border-status-block/40">
                    Блокеров: {summary.blockers.length}
                  </Badge>
                )}
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </div>
        </Link>
      </div>
    </ScrollArea>
  );
}
