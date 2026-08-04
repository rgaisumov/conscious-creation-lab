import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useProduction } from "@/lib/production/store";

export const Route = createFileRoute("/products/")({
  head: () => ({
    meta: [
      { title: "Изделия — конструкторские данные и партии" },
      {
        name: "description",
        content:
          "Каталог изделий: операции тех.маршрута, группы компонентов и связанные производственные партии.",
      },
      { property: "og:title", content: "Изделия — конструкторские данные и партии" },
      { property: "og:description", content: "Операции, компоненты и партии по каждому изделию." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { products, batches, addProduct, summaryOf } = useProduction();
  const navigate = useNavigate();

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Изделия</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Изделие хранит знание о производстве, партия — его исполнение.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const id = addProduct();
            navigate({ to: "/products", hash: id });
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Новое изделие
        </button>
      </header>

      <div className="space-y-4 p-6">
        {products.map((p) => {
          const own = batches.filter((b) => b.productId === p.id);
          return (
            <section key={p.id} id={p.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-card-foreground">
                    {p.name} <span className="text-muted-foreground font-normal">· {p.version}</span>
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.operations.length} операций · {p.components.length} групп компонентов
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <Link
                  to="/products/$productId"
                  params={{ productId: p.id }}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                >
                  Редактировать тех.маршрут / граф
                </Link>
              </div>


              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {own.map((b) => {
                  const s = summaryOf(b);
                  return (
                    <Link
                      key={b.id}
                      to="/batches/$batchId"
                      params={{ batchId: b.id }}
                      className="rounded-md border border-border bg-background p-3 text-xs transition-colors hover:border-primary/50"
                    >
                      <div className="font-medium text-foreground">Партия {b.number}</div>
                      <div className="mt-1 text-muted-foreground">
                        {b.orderedQty} шт · отгружено {s.shipped} · {s.primaryBlockingReason}
                      </div>
                    </Link>
                  );
                })}
                {own.length === 0 && (
                  <div className="text-xs text-muted-foreground">Партий пока нет</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
