import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useProduction } from "@/lib/production/store";

export const Route = createFileRoute("/products/$productId")({
  head: () => ({
    meta: [
      { title: "Редактор изделия — тех.маршрут и граф" },
      {
        name: "description",
        content:
          "Редактирование маршрута изделия по умолчанию: операции, компоненты и связи графа для всех новых партий.",
      },
      { property: "og:title", content: "Редактор изделия — тех.маршрут и граф" },
      { property: "og:description", content: "Маршрут по умолчанию применяется ко всем новым партиям изделия." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductEditorLayout,
});

function ProductEditorLayout() {
  const { productId } = Route.useParams();
  const { getProduct } = useProduction();
  const product = getProduct(productId);
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  if (!product) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Изделие не найдено</p>
          <Link to="/products" className="mt-3 inline-block text-sm text-primary hover:underline">
            К списку изделий
          </Link>
        </div>
      </div>
    );
  }

  const base = `/products/${product.id}`;
  const tabs = [
    { label: "Тех.маршрут", to: base, exact: true },
    { label: "Граф", to: `${base}/graph`, exact: false },
  ];

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <header className="border-b border-border px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/products" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-semibold">
            {product.name} <span className="font-normal text-muted-foreground">· {product.version}</span>
          </h1>
          <span className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            маршрут по умолчанию — применится ко всем новым партиям
          </span>
        </div>
        <nav className="mt-3 flex gap-1">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                  active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="flex-1 min-h-0 overflow-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
