import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useProduction } from "@/lib/production/store";
import { BatchWorkspaceProvider, useWorkspace } from "@/lib/production/workspace";
import { RightPanel } from "@/components/batch/RightPanel";

export const Route = createFileRoute("/batches/$batchId")({
  head: () => ({
    meta: [
      { title: "Партия — тех.маршрут и узкое место" },
      {
        name: "description",
        content:
          "Рабочее пространство партии: технологический маршрут, граф изделия, компоненты и текущий блокер выпуска.",
      },
      { property: "og:title", content: "Партия — тех.маршрут и узкое место" },
      { property: "og:description", content: "Маршрут, граф и компоненты одной производственной партии." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BatchLayout,
});

function BatchLayout() {
  const { batchId } = Route.useParams();
  const { getBatch, getProduct } = useProduction();
  const batch = getBatch(batchId);
  const base = batch ? getProduct(batch.productId) : undefined;
  const product = batch && base ? effectiveProductFor(base, batch) : undefined;


  if (!batch || !product) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Партия не найдена</p>
          <Link to="/" className="mt-3 inline-block text-sm text-primary hover:underline">
            К списку партий
          </Link>
        </div>
      </div>
    );
  }

  return (
    <BatchWorkspaceProvider product={product} batch={batch}>
      <BatchChrome />
    </BatchWorkspaceProvider>
  );
}

function BatchChrome() {
  const { product, batch, summary } = useWorkspace();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const base = `/batches/${batch.id}`;

  const tabs = [
    { label: "Тех.маршрут", to: base, exact: true },
    { label: "Граф", to: `${base}/graph`, exact: false },
    { label: "Компоненты", to: `${base}/components`, exact: false },
  ];

  const metrics = [
    { label: "Партия", value: `${summary.batchSize} шт` },
    { label: "Укомплектовано", value: `${summary.equipped}/${summary.batchSize}` },
    { label: "Собрано", value: `${summary.assembled}/${summary.batchSize}` },
    { label: "Испытано", value: `${summary.tested}/${summary.batchSize}` },
    { label: "Отгружено", value: `${summary.shipped}/${summary.batchSize}` },
  ];

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <header className="border-b border-border px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-semibold">
            {product.name} <span className="text-muted-foreground font-normal">· партия {batch.number}</span>
          </h1>
          <span
            className={`rounded border px-2 py-0.5 text-[11px] ${
              summary.blockers.length > 0
                ? "border-status-block/40 bg-status-block/10 text-status-block"
                : "border-status-done/40 bg-status-done/10 text-status-done"
            }`}
          >
            {summary.primaryBlockingReason}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-md border border-border bg-card px-3 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
              <div className="text-sm font-semibold text-card-foreground">{m.value}</div>
            </div>
          ))}
        </div>

        <nav className="mt-3 flex gap-1">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 overflow-auto">
          <Outlet />
        </div>
        <RightPanel />
      </div>
    </div>
  );
}
