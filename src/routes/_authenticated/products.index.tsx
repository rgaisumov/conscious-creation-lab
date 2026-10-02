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
  const { products, batches, addProduct } = useProduction();
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
            navigate({ to: "/products/$productId", params: { productId: id } });
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
        {visible.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Изделие</th>
                  <th className="px-3 py-2 text-left font-medium">Версия</th>
                  <th className="px-3 py-2 text-right font-medium">Операций</th>
                  <th className="px-3 py-2 text-right font-medium">Групп состава</th>
                  <th className="px-3 py-2 text-left font-medium">Примечание</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} id={p.id} className="border-t border-border hover:bg-accent/40">
                    <td className="px-3 py-2">
                      <Link to="/products/$productId" params={{ productId: p.id }} className="font-medium text-primary hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{p.version}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{p.operations.length}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{p.components.filter((c) => c.type !== "semi-product").length}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{p.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
