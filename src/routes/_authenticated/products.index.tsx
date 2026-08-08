import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useProduction } from "@/lib/production/store";

export const Route = createFileRoute("/_authenticated/products/")({
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
  const [query, setQuery] = useState("");
  const [withBatches, setWithBatches] = useState(false);

  const q = query.trim().toLowerCase();
  const visible = products.filter((p) => {
    if (withBatches && !batches.some((b) => b.productId === p.id)) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.version.toLowerCase().includes(q) ||
      (p.note ?? "").toLowerCase().includes(q) ||
      p.operations.some((o) => o.name.toLowerCase().includes(q)) ||
      p.components.some((c) => c.name.toLowerCase().includes(q))
    );
  });

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

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: изделие, операция, компонент…"
            className="w-72 rounded-md border border-border bg-background px-2 py-1.5 pl-7 text-xs text-foreground"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={withBatches} onChange={(e) => setWithBatches(e.target.checked)} />
          только с партиями
        </label>
      </div>

      <div className="space-y-4 p-6">
        {visible.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Изделия не найдены.
          </div>
        )}
        {visible.map((p) => {
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
