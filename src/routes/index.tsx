import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ChangeEvent } from "react";
import {
  LayoutDashboard,
  Workflow,
  ListChecks,
  Package,
  ShoppingCart,
  FileBarChart,
  FileText,
  Settings,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Play,
  User,
  Timer,
  Save,
  Upload,
  X,
  Plus,
  Minus,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

import { initialProduct } from "@/lib/production/data";
import { computeSummary } from "@/lib/production/calculator";
import type {
  Product,
  Operation,
  OperationComputed,
  OperationVisualStatus,
} from "@/lib/production/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Трекер партии — Модуль-А" },
      {
        name: "description",
        content:
          "Интерактивный трекер производства партии: маршрут операций, компоненты, узкие места и прогноз выпуска.",
      },
      { property: "og:title", content: "Трекер партии — Модуль-А" },
      {
        property: "og:description",
        content: "Визуальный контроль партии: где узкое место, что заказать и когда будет готово.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrackerPage,
});

const NAV_ITEMS = [
  { id: "overview", label: "Обзор", icon: LayoutDashboard, disabled: true },
  { id: "graph", label: "Граф", icon: Workflow, disabled: false },
  { id: "operations", label: "Операции", icon: ListChecks, disabled: true },
  { id: "components", label: "Компоненты", icon: Package, disabled: true },
  { id: "procurement", label: "Закупки", icon: ShoppingCart, disabled: true },
  { id: "reports", label: "Отчёты", icon: FileBarChart, disabled: true },
  { id: "documents", label: "Документы", icon: FileText, disabled: true },
  { id: "settings", label: "Настройки", icon: Settings, disabled: true },
];

const STATUS_META: Record<
  OperationVisualStatus,
  { label: string; dot: string; bar: string; badge: string; ring: string }
> = {
  blocked: {
    label: "БЛОКИРУЕТ ВЫПУСК",
    dot: "bg-status-block",
    bar: "bg-status-block",
    badge: "bg-status-block/15 text-status-block border-status-block/40",
    ring: "border-l-status-block",
  },
  next: {
    label: "СЛЕДУЮЩАЯ ПРОБЛЕМА",
    dot: "bg-status-next",
    bar: "bg-status-next",
    badge: "bg-status-next/15 text-status-next border-status-next/40",
    ring: "border-l-status-next",
  },
  waiting: {
    label: "ЖДЁТ ПРЕДЫДУЩУЮ",
    dot: "bg-status-wait",
    bar: "bg-status-wait",
    badge: "bg-status-wait/15 text-status-wait border-status-wait/40",
    ring: "border-l-status-wait",
  },
  ready: {
    label: "ГОТОВА К ЗАПУСКУ",
    dot: "bg-status-ready",
    bar: "bg-status-ready",
    badge: "bg-status-ready/15 text-foreground border-status-ready/40",
    ring: "border-l-status-ready",
  },
  running: {
    label: "ВЫПОЛНЯЕТСЯ",
    dot: "bg-status-run",
    bar: "bg-status-run",
    badge: "bg-status-run/15 text-status-run border-status-run/40",
    ring: "border-l-status-run",
  },
  done: {
    label: "ЗАВЕРШЕНА",
    dot: "bg-status-done",
    bar: "bg-status-done",
    badge: "bg-status-done/15 text-status-done border-status-done/40",
    ring: "border-l-status-done",
  },
};

function TrackerPage() {
  const [product, setProduct] = useState<Product>(initialProduct);
  const [selectedOpId, setSelectedOpId] = useState<string>(initialProduct.operations[1]?.id ?? "");
  const [showSemiProducts, setShowSemiProducts] = useState(false);
  const [showRequirements, setShowRequirements] = useState(true);
  const [activeNav, setActiveNav] = useState("graph");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const summary = useMemo(() => computeSummary(product), [product]);
  const selectedComputed =
    summary.operations.find((o) => o.operationId === selectedOpId) ?? summary.operations[0];
  const selectedOp = product.operations.find((o) => o.id === selectedComputed?.operationId);

  function setBatchSize(n: number) {
    setProduct((p) => ({ ...p, batchSize: Math.max(1, n) }));
  }
  function setShipped(n: number) {
    setProduct((p) => ({ ...p, shippedUnits: Math.max(0, Math.min(p.batchSize, n)) }));
  }
  function updateOperation(id: string, patch: Partial<Operation>) {
    setProduct((p) => ({
      ...p,
      operations: p.operations.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(product, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${product.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importJson(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(String(r.result)) as Product;
        setProduct(parsed);
      } catch (err) {
        console.error("Import failed", err);
      }
    };
    r.readAsText(f);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground dark">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all",
          sidebarCollapsed ? "w-14" : "w-60",
        )}
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-md bg-primary/20 flex items-center justify-center">
            <Workflow className="h-4 w-4 text-primary" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">Трекер партии</div>
              <div className="text-xs text-muted-foreground truncate">{product.name}</div>
            </div>
          )}
        </div>
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeNav;
            return (
              <button
                key={item.id}
                onClick={() => !item.disabled && setActiveNav(item.id)}
                disabled={item.disabled}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  item.disabled && "opacity-40 cursor-not-allowed",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {item.disabled && <span className="text-[10px] uppercase text-muted-foreground">скоро</span>}
                  </>
                )}
              </button>
            );
          })}
        </nav>
        <div className="p-2 border-t border-sidebar-border flex flex-col gap-1">
          <Button variant="ghost" size="sm" className="justify-start" onClick={exportJson}>
            <Save className="h-4 w-4" />
            {!sidebarCollapsed && <span>Сохранить</span>}
          </Button>
          <label className="cursor-pointer">
            <input type="file" accept="application/json" onChange={importJson} className="hidden" />
            <div className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-sidebar-accent/50 text-sidebar-foreground/80">
              <Upload className="h-4 w-4" />
              {!sidebarCollapsed && <span>Загрузить</span>}
            </div>
          </label>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => setSidebarCollapsed((v) => !v)}
          >
            <ChevronRight className={cn("h-4 w-4 transition", !sidebarCollapsed && "rotate-180")} />
            {!sidebarCollapsed && <span>Свернуть</span>}
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <BatchStatusBar
          product={product}
          summary={summary}
          setBatchSize={setBatchSize}
          setShipped={setShipped}
        />

        <div className="flex-1 flex min-h-0">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-lg font-semibold">Технологический маршрут</h1>
                  <p className="text-xs text-muted-foreground">
                    Партия {product.batchSize} шт · {product.operations.length} операций
                  </p>
                </div>
              </div>

              {summary.operations
                .filter(
                  (oc) =>
                    showSemiProducts ||
                    product.operations.find((o) => o.id === oc.operationId),
                )
                .map((oc, idx, arr) => {
                  const op = product.operations.find((o) => o.id === oc.operationId)!;
                  return (
                    <div key={op.id}>
                      <OperationRow
                        index={idx + 1}
                        operation={op}
                        computed={oc}
                        batchSize={product.batchSize}
                        selected={selectedOpId === op.id}
                        showRequirements={showRequirements}
                        showSemiProducts={showSemiProducts}
                        product={product}
                        onSelect={() => setSelectedOpId(op.id)}
                      />
                      {idx < arr.length - 1 && (
                        <div className="flex justify-center my-1 text-muted-foreground/40">
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </ScrollArea>

          {/* Details panel */}
          {selectedComputed && selectedOp && (
            <DetailsPanel
              product={product}
              operation={selectedOp}
              computed={selectedComputed}
              onClose={() => setSelectedOpId("")}
              onChangeCompleted={(n) => updateOperation(selectedOp.id, { completedUnits: n })}
            />
          )}
        </div>

        <LegendBar
          showRequirements={showRequirements}
          setShowRequirements={setShowRequirements}
          showSemiProducts={showSemiProducts}
          setShowSemiProducts={setShowSemiProducts}
        />
      </div>
    </div>
  );
}

/* ------------------------ Batch status bar ------------------------ */

function BatchStatusBar({
  product,
  summary,
  setBatchSize,
  setShipped,
}: {
  product: Product;
  summary: ReturnType<typeof computeSummary>;
  setBatchSize: (n: number) => void;
  setShipped: (n: number) => void;
}) {
  return (
    <header className="border-b border-border bg-card px-6 py-4">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-[260px]">
          <div className="text-xs uppercase text-muted-foreground mb-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-status-block" />
            Ограничивают выпуск
          </div>
          {summary.blockers.length === 0 ? (
            <div className="text-sm text-status-done">Блокеров нет — можно вести партию дальше</div>
          ) : (
            <ol className="text-sm space-y-0.5">
              {summary.blockers.map((b, i) => (
                <li key={b.operationId} className="flex gap-2">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <span>
                    <span className="font-medium">{b.operationName}</span>
                    <span className="text-muted-foreground"> — {b.reason}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex gap-3 flex-wrap">
          <MetricTile label="Партия">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setBatchSize(product.batchSize - 10)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                value={product.batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="h-7 w-16 text-center text-base font-semibold"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setBatchSize(product.batchSize + 10)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">шт</div>
          </MetricTile>
          <MetricTile label="Укомплектовано" tone={summary.equipped < product.batchSize ? "warn" : "ok"}>
            <div className="text-lg font-semibold">
              {summary.equipped} <span className="text-muted-foreground text-sm">/ {product.batchSize}</span>
            </div>
            <MiniBar value={summary.equipped} max={product.batchSize} tone="warn" />
          </MetricTile>
          <MetricTile label="Собрано">
            <div className="text-lg font-semibold">
              {summary.assembled} <span className="text-muted-foreground text-sm">/ {product.batchSize}</span>
            </div>
            <MiniBar value={summary.assembled} max={product.batchSize} tone="run" />
          </MetricTile>
          <MetricTile label="Испытано">
            <div className="text-lg font-semibold">
              {summary.tested} <span className="text-muted-foreground text-sm">/ {product.batchSize}</span>
            </div>
            <MiniBar value={summary.tested} max={product.batchSize} tone="done" />
          </MetricTile>
          <MetricTile label="Отгружено">
            <Input
              type="number"
              value={product.shippedUnits}
              onChange={(e) => setShipped(Number(e.target.value))}
              className="h-7 w-20 text-center text-base font-semibold"
            />
            <div className="text-xs text-muted-foreground mt-0.5">из {product.batchSize}</div>
          </MetricTile>
          <MetricTile label="Прогноз">
            <div className="text-lg font-semibold">
              ~{Math.ceil(summary.fullBatchLeadDays + summary.totalProductionDays)}
              <span className="text-muted-foreground text-sm"> дн</span>
            </div>
            <div className="text-xs text-muted-foreground">
              поставка +{Math.ceil(summary.fullBatchLeadDays)}, работа +
              {Math.ceil(summary.totalProductionDays)}
            </div>
          </MetricTile>
        </div>
      </div>
    </header>
  );
}

function MetricTile({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "ok" | "warn" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-background px-3 py-2 min-w-[120px]",
        tone === "warn" && "border-status-wait/40",
        tone === "danger" && "border-status-block/40",
      )}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function MiniBar({ value, max, tone }: { value: number; max: number; tone: "warn" | "run" | "done" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = tone === "warn" ? "bg-status-wait" : tone === "run" ? "bg-status-run" : "bg-status-done";
  return (
    <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
      <div className={cn("h-full", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ------------------------ Operation row ------------------------ */

function OperationRow({
  index,
  operation,
  computed,
  batchSize,
  selected,
  showRequirements,
  showSemiProducts,
  product,
  onSelect,
}: {
  index: number;
  operation: Operation;
  computed: OperationComputed;
  batchSize: number;
  selected: boolean;
  showRequirements: boolean;
  showSemiProducts: boolean;
  product: Product;
  onSelect: () => void;
}) {
  const meta = STATUS_META[computed.status];
  const completedPct = batchSize > 0 ? (computed.completed / batchSize) * 100 : 0;
  const canPct =
    batchSize > 0 ? ((computed.completed + computed.canPerformNow) / batchSize) * 100 : 0;

  const visibleReqs = computed.requirements.filter((r) =>
    showSemiProducts ? true : r.type !== "semi-product",
  );
  const okCount = visibleReqs.filter((r) => r.ok).length;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-lg border bg-card border-l-4 transition-all",
        meta.ring,
        "border-border",
        selected ? "ring-2 ring-primary/50 shadow-lg" : "hover:bg-card/80",
      )}
    >
      <div className="flex items-stretch gap-4 p-4">
        {/* Left: title + meta */}
        <div className="w-56 shrink-0">
          <div className="flex items-center gap-2">
            <div className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
            <div className="text-sm font-semibold">
              {index}. {operation.name}
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
            <User className="h-3 w-3" />
            {operation.responsible}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Timer className="h-3 w-3" />
            {operation.durationHours} ч на партию
          </div>
        </div>

        {/* Middle: progress */}
        <div className="flex-1 min-w-[180px] space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-muted-foreground">Выполнено</span>
              <span className="font-medium">
                {computed.completed} / {batchSize}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-status-done" style={{ width: `${completedPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-muted-foreground">Можно выполнить сейчас</span>
              <span className="font-medium">
                +{computed.canPerformNow}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden relative">
              <div className="h-full bg-status-done/60 absolute left-0 top-0" style={{ width: `${completedPct}%` }} />
              <div
                className={cn("h-full absolute left-0 top-0", meta.bar, "opacity-60")}
                style={{ width: `${canPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Requirements */}
        {showRequirements && visibleReqs.length > 0 && (
          <div className="w-64 shrink-0">
            <div className="text-xs text-muted-foreground mb-1">
              Требуется ({okCount}/{visibleReqs.length})
            </div>
            <div className="space-y-1">
              {visibleReqs.slice(0, 4).map((r) => (
                <div key={r.componentId} className="flex items-center gap-2 text-xs">
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      r.ok ? "bg-status-done" : "bg-status-block",
                    )}
                  />
                  <span className="flex-1 truncate">{r.componentName}</span>
                  <span className={cn("tabular-nums", !r.ok && "text-status-block font-medium")}>
                    {Number.isFinite(r.available) ? r.available : "∞"}/{r.required}
                  </span>
                </div>
              ))}
              {visibleReqs.length > 4 && (
                <div className="text-xs text-muted-foreground">+{visibleReqs.length - 4}…</div>
              )}
            </div>
          </div>
        )}

        {/* Status badge */}
        <div className="w-44 shrink-0 flex flex-col items-end justify-between">
          <Badge variant="outline" className={cn("text-[10px] font-semibold", meta.badge)}>
            {meta.label}
          </Badge>
          <div className="text-xs text-muted-foreground text-right mt-2 line-clamp-2">
            {computed.reason}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ------------------------ Details panel ------------------------ */

function DetailsPanel({
  product,
  operation,
  computed,
  onClose,
  onChangeCompleted,
}: {
  product: Product;
  operation: Operation;
  computed: OperationComputed;
  onClose: () => void;
  onChangeCompleted: (n: number) => void;
}) {
  const meta = STATUS_META[computed.status];
  return (
    <aside className="w-96 shrink-0 border-l border-border bg-card overflow-y-auto">
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Операция {operation.order}
            </div>
            <h2 className="text-lg font-semibold mt-0.5">{operation.name}</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Badge variant="outline" className={cn("mt-3 text-[10px] font-semibold", meta.badge)}>
          {meta.label}
        </Badge>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Ответственный</div>
            <div>{operation.responsible}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Время</div>
            <div>{operation.durationHours} ч</div>
          </div>
        </div>

        {operation.note && (
          <div className="text-sm rounded-md bg-muted/50 p-3 text-muted-foreground">
            {operation.note}
          </div>
        )}

        <div>
          <Label className="text-xs text-muted-foreground">Выполнено (шт)</Label>
          <Input
            type="number"
            value={operation.completedUnits}
            onChange={(e) =>
              onChangeCompleted(
                Math.max(0, Math.min(product.batchSize, Number(e.target.value))),
              )
            }
            className="mt-1"
          />
        </div>

        {computed.shortages.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-4 w-4 text-status-block" />
              Почему нельзя запустить
            </h3>
            <div className="space-y-2">
              {computed.shortages.map((s) => (
                <div
                  key={s.componentId}
                  className="rounded-md border border-status-block/40 bg-status-block/5 p-3 text-sm"
                >
                  <div className="font-medium">{s.componentName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    доступно {s.available} · нужно {s.required} · нехватка{" "}
                    <span className="text-status-block font-medium">{s.required - s.available}</span>
                  </div>
                  {s.leadTimeDays > 0 && (
                    <div className="text-xs text-muted-foreground">
                      срок поставки: {s.leadTimeDays} дн
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {computed.waitingFor && (
          <div className="rounded-md border border-status-wait/40 bg-status-wait/5 p-3 text-sm">
            <div className="flex items-center gap-1.5 font-medium">
              <Clock className="h-4 w-4 text-status-wait" />
              Ждёт: {computed.waitingFor.operationName}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              не хватает результатов предыдущей операции: {computed.waitingFor.missing} шт
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold mb-2">Требуется для запуска</h3>
          <div className="space-y-1.5">
            {computed.requirements.map((r) => (
              <div
                key={r.componentId}
                className="flex items-center gap-2 text-sm px-2 py-1.5 rounded bg-muted/40"
              >
                <div
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    r.ok ? "bg-status-done" : "bg-status-block",
                  )}
                />
                <span className="flex-1 truncate">{r.componentName}</span>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    !r.ok && "text-status-block font-medium",
                  )}
                >
                  {Number.isFinite(r.available) ? r.available : "∞"}/{r.required}
                </span>
              </div>
            ))}
          </div>
        </div>

        {computed.status === "done" && (
          <div className="flex items-center gap-2 text-sm text-status-done">
            <CheckCircle2 className="h-4 w-4" />
            Операция завершена по всей партии
          </div>
        )}
      </div>
    </aside>
  );
}

/* ------------------------ Legend / footer bar ------------------------ */

function LegendBar({
  showRequirements,
  setShowRequirements,
  showSemiProducts,
  setShowSemiProducts,
}: {
  showRequirements: boolean;
  setShowRequirements: (v: boolean) => void;
  showSemiProducts: boolean;
  setShowSemiProducts: (v: boolean) => void;
}) {
  const items: { label: string; color: string }[] = [
    { label: "Блокирует", color: "bg-status-block" },
    { label: "Следующая проблема", color: "bg-status-next" },
    { label: "Ждёт предыдущую", color: "bg-status-wait" },
    { label: "Готова", color: "bg-status-ready" },
    { label: "Выполняется", color: "bg-status-run" },
    { label: "Завершена", color: "bg-status-done" },
  ];
  return (
    <footer className="border-t border-border bg-card px-6 py-3 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-4 flex-wrap">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={cn("h-2 w-2 rounded-full", it.color)} />
            {it.label}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={showRequirements} onCheckedChange={setShowRequirements} />
          Компоненты в карточках
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={showSemiProducts} onCheckedChange={setShowSemiProducts} />
          Полуфабрикаты
        </label>
      </div>
    </footer>
  );
}
