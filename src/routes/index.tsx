import { createFileRoute } from "@tanstack/react-router";
import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useId,
  forwardRef,
  type ChangeEvent,
  type MouseEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { initialProduct } from "@/lib/production/data";
import {
  computeProductCalculations,
  getShortageForBatch,
} from "@/lib/production/calculator";
import type {
  Product,
  ComponentGroup,
  Operation,
  Position,
  ComponentType,
} from "@/lib/production/types";

import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Upload,
  RotateCcw,
  Factory,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCircle,
  Settings2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Планер производства — интерактивный трекер операций" },
      {
        name: "description",
        content:
          "Офлайн-инструмент для отслеживания производственных операций: визуальный граф, расчёт запускаемой партии, остатки и сроки поставки.",
      },
      {
        property: "og:title",
        content: "Планер производства — интерактивный трекер операций",
      },
      {
        property: "og:description",
        content:
          "Офлайн-инструмент для отслеживания производственных операций: визуальный граф, расчёт запускаемой партии, остатки и сроки поставки.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductionTrackerPage,
});

const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  material: "материал",
  eri: "ЭРИ",
  fixture: "оснастка",
  "semi-product": "промизделие",
};

const COMPONENT_TYPE_COLORS: Record<ComponentType, string> = {
  material: "bg-secondary text-secondary-foreground",
  eri: "bg-primary/10 text-primary",
  fixture: "bg-accent text-accent-foreground",
  "semi-product": "bg-status-info/10 text-status-info",
};

function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function ProductionTrackerPage() {
  const [product, setProduct] = useState<Product>(clone(initialProduct));
  const [batchSize, setBatchSize] = useState<number>(100);
  const [editMode, setEditMode] = useState(false);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const componentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const operationRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [arrowPaths, setArrowPaths] = useState<
    { id: string; d: string; color: string; strokeWidth: number; dashed: boolean }[]
  >([]);

  const calc = useMemo(() => computeProductCalculations(product, batchSize), [product, batchSize]);
  const sortedOperations = useMemo(
    () => [...product.operations].sort((a, b) => a.order - b.order),
    [product.operations],
  );
  const operationResultMap = useMemo(() => {
    const map = new Map<string, (typeof calc.operationResults)[number]>();
    for (const result of calc.operationResults) {
      map.set(result.operationId, result);
    }
    return map;
  }, [calc.operationResults]);

  const recomputeArrows = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const newPaths: typeof arrowPaths = [];

    const getPoint = (el: HTMLElement, side: "left" | "right" | "top" | "bottom") => {
      const rect = el.getBoundingClientRect();
      const x = rect.left - containerRect.left;
      const y = rect.top - containerRect.top;
      if (side === "left") return { x: x, y: y + rect.height / 2 };
      if (side === "right") return { x: x + rect.width, y: y + rect.height / 2 };
      if (side === "top") return { x: x + rect.width / 2, y: y };
      return { x: x + rect.width / 2, y: y + rect.height };
    };

    // Component -> operation arrows
    for (const operation of sortedOperations) {
      const opEl = operationRefs.current.get(operation.id);
      if (!opEl) continue;
      const opResult = operationResultMap.get(operation.id);
      const opCanDo = opResult?.canCompleteUnits ?? 0;
      const target = getPoint(opEl, "left");

      for (const componentId of operation.inputComponentIds) {
        const compEl = componentRefs.current.get(componentId);
        if (!compEl) continue;
        const source = getPoint(compEl, "right");
        const component = product.components.find((c) => c.id === componentId);
        const isBottleneck = opResult?.limitedBy.type === "component" && opResult.limitedBy.id === componentId;
        const isSufficient = opCanDo >= batchSize;
        const color = isBottleneck ? "var(--color-status-danger)" : isSufficient ? "var(--color-status-ok)" : "var(--color-status-warn)";
        const dashed = component?.type === "fixture";

        const d = `M ${source.x} ${source.y} C ${source.x + 48} ${source.y}, ${target.x - 48} ${target.y}, ${target.x} ${target.y}`;
        newPaths.push({ id: `${componentId}->${operation.id}`, d, color, strokeWidth: isBottleneck ? 3 : 2, dashed });
      }
    }

    // Operation -> operation arrows
    for (let i = 0; i < sortedOperations.length - 1; i++) {
      const fromOp = sortedOperations[i];
      const toOp = sortedOperations[i + 1];
      const fromEl = operationRefs.current.get(fromOp.id);
      const toEl = operationRefs.current.get(toOp.id);
      if (!fromEl || !toEl) continue;
      const source = getPoint(fromEl, "right");
      const target = getPoint(toEl, "left");
      const toResult = operationResultMap.get(toOp.id);
      const isBottleneck = toResult?.limitedBy.type === "previous-operation";
      const isSufficient = (toResult?.canCompleteUnits ?? 0) >= batchSize;
      const color = isBottleneck ? "var(--color-status-danger)" : isSufficient ? "var(--color-status-ok)" : "var(--color-status-warn)";

      const d = `M ${source.x} ${source.y} C ${source.x + 48} ${source.y}, ${target.x - 48} ${target.y}, ${target.x} ${target.y}`;
      newPaths.push({ id: `${fromOp.id}->${toOp.id}`, d, color, strokeWidth: isBottleneck ? 3 : 2, dashed: false });
    }

    setArrowPaths(newPaths);
  }, [product.components, sortedOperations, operationResultMap, batchSize]);

  useEffect(() => {
    const timer = requestAnimationFrame(recomputeArrows);
    return () => cancelAnimationFrame(timer);
  }, [recomputeArrows]);

  useEffect(() => {
    const handleResize = () => recomputeArrows();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [recomputeArrows]);

  const toggleComponentExpanded = (id: string) => {
    setExpandedComponents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateProduct = (updater: (draft: Product) => void) => {
    setProduct((prev) => {
      const draft = clone(prev);
      updater(draft);
      return draft;
    });
  };

  const handleSave = () => {
    const blob = new Blob([JSON.stringify(product, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${product.name || "izdelie"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const loaded = JSON.parse(String(reader.result)) as Product;
        setProduct(loaded);
        setExpandedComponents(new Set());
      } catch {
        alert("Не удалось загрузить файл. Проверьте формат JSON.");
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (confirm("Сбросить к демонстрационному изделию?")) {
      setProduct(clone(initialProduct));
      setExpandedComponents(new Set());
    }
  };

  const addComponent = (type: ComponentType) => {
    updateProduct((draft) => {
      const id = generateId(type);
      const newComponent: ComponentGroup = {
        id,
        name: type === "eri" ? "Новая группа ЭРИ" : "Новый компонент",
        type,
        positions:
          type === "fixture"
            ? []
            : [{ id: generateId("pos"), name: "Позиция 1", quantityPerUnit: 1, stock: 0, leadTimeDays: 0 }],
        isShared: type === "fixture" ? true : undefined,
        fixtureCount: type === "fixture" ? 1 : undefined,
      };
      draft.components.push(newComponent);
    });
    setExpandedComponents((prev) => new Set(prev).add(generateId("placeholder")));
  };

  const removeComponent = (id: string) => {
    updateProduct((draft) => {
      draft.components = draft.components.filter((c) => c.id !== id);
      for (const op of draft.operations) {
        op.inputComponentIds = op.inputComponentIds.filter((cid) => cid !== id);
        if (op.outputComponentId === id) op.outputComponentId = null;
      }
    });
  };

  const updateComponentField = <K extends keyof ComponentGroup>(
    id: string,
    key: K,
    value: ComponentGroup[K],
  ) => {
    updateProduct((draft) => {
      const comp = draft.components.find((c) => c.id === id);
      if (comp) (comp[key] as ComponentGroup[K]) = value;
    });
  };

  const updatePosition = (componentId: string, positionId: string, patch: Partial<Position>) => {
    updateProduct((draft) => {
      const comp = draft.components.find((c) => c.id === componentId);
      if (!comp) return;
      const pos = comp.positions.find((p) => p.id === positionId);
      if (pos) Object.assign(pos, patch);
    });
  };

  const addPosition = (componentId: string) => {
    updateProduct((draft) => {
      const comp = draft.components.find((c) => c.id === componentId);
      if (!comp) return;
      comp.positions.push({
        id: generateId("pos"),
        name: `Позиция ${comp.positions.length + 1}`,
        quantityPerUnit: 1,
        stock: 0,
        leadTimeDays: 0,
      });
    });
  };

  const removePosition = (componentId: string, positionId: string) => {
    updateProduct((draft) => {
      const comp = draft.components.find((c) => c.id === componentId);
      if (!comp) return;
      comp.positions = comp.positions.filter((p) => p.id !== positionId);
    });
  };

  const addOperation = () => {
    updateProduct((draft) => {
      const maxOrder = Math.max(0, ...draft.operations.map((o) => o.order));
      draft.operations.push({
        id: generateId("op"),
        name: "Новая операция",
        responsible: "",
        durationHours: 1,
        order: maxOrder + 1,
        inputComponentIds: [],
        outputComponentId: null,
      });
    });
  };

  const removeOperation = (id: string) => {
    updateProduct((draft) => {
      draft.operations = draft.operations.filter((o) => o.id !== id);
    });
  };

  const updateOperationField = <K extends keyof Operation>(
    id: string,
    key: K,
    value: Operation[K],
  ) => {
    updateProduct((draft) => {
      const op = draft.operations.find((o) => o.id === id);
      if (op) (op[key] as Operation[K]) = value;
    });
  };

  const toggleOperationInput = (operationId: string, componentId: string) => {
    updateProduct((draft) => {
      const op = draft.operations.find((o) => o.id === operationId);
      if (!op) return;
      if (op.inputComponentIds.includes(componentId)) {
        op.inputComponentIds = op.inputComponentIds.filter((id) => id !== componentId);
      } else {
        op.inputComponentIds.push(componentId);
      }
    });
  };

  const moveOperation = (id: string, direction: -1 | 1) => {
    updateProduct((draft) => {
      const ops = draft.operations.sort((a, b) => a.order - b.order);
      const idx = ops.findIndex((o) => o.id === id);
      if (idx < 0) return;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= ops.length) return;
      const temp = ops[idx].order;
      ops[idx].order = ops[newIdx].order;
      ops[newIdx].order = temp;
    });
  };

  const summary = calc;
  const globalBottleneckName = summary.globalBottleneck.name;
  const isBatchFullyAvailable = summary.canStartNow >= batchSize;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Toolbar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Factory className="h-6 w-6 text-primary" />
            {editMode ? (
              <Input
                value={product.name}
                onChange={(e) => updateProduct((d) => (d.name = e.target.value))}
                className="h-8 w-48 font-semibold"
              />
            ) : (
              <h1 className="text-lg font-semibold tracking-tight">{product.name}</h1>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="batch-size" className="text-sm text-muted-foreground">
                Партия
              </Label>
              <Input
                id="batch-size"
                type="number"
                min={1}
                value={batchSize}
                onChange={(e) => setBatchSize(Math.max(1, Number(e.target.value)))}
                className="h-8 w-24 text-right"
              />
              <span className="text-sm text-muted-foreground">шт.</span>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="edit-mode" checked={editMode} onCheckedChange={setEditMode} />
              <Label htmlFor="edit-mode" className="flex cursor-pointer items-center gap-1 text-sm">
                <Settings2 className="h-4 w-4" />
                Редактирование
              </Label>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="mr-1 h-4 w-4" />
                Сохранить
              </Button>
              <Button variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  <Upload className="mr-1 h-4 w-4" />
                  Загрузить
                  <input type="file" accept=".json,application/json" onChange={handleLoad} className="sr-only" />
                </label>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleReset} title="Сбросить">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Summary */}
      <section className="border-b border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
                isBatchFullyAvailable
                  ? "bg-status-ok text-status-ok-foreground"
                  : "bg-status-warn text-status-warn-foreground",
              )}
            >
              {isBatchFullyAvailable ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              Можно начать сейчас: {summary.canStartNow} шт.
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Boxes className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Ограничивает:</span>
            <span className="font-medium text-foreground">{globalBottleneckName}</span>
            <span className="text-muted-foreground">({summary.globalBottleneck.availableUnits} шт.)</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Полная партия через:</span>
            <span className="font-medium text-foreground">
              {summary.fullBatchAvailabilityDays} дн.
            </span>
            <span className="text-muted-foreground">(изготовление ~{summary.estimatedCompletionDays.toFixed(1)} дн.)</span>
          </div>
        </div>
      </section>

      {/* Main content */}
      <main
        ref={containerRef}
        className="relative flex flex-1 overflow-hidden"
        onClick={(e: MouseEvent<HTMLDivElement>) => {
          // Recompute arrows after any click (e.g. expanding cards)
          requestAnimationFrame(recomputeArrows);
        }}
      >
        {/* SVG overlay for arrows */}
        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-foreground" />
            </marker>
          </defs>
          {arrowPaths.map((arrow) => (
            <path
              key={arrow.id}
              d={arrow.d}
              fill="none"
              stroke={arrow.color}
              strokeWidth={arrow.strokeWidth}
              strokeDasharray={arrow.dashed ? "6 4" : undefined}
              markerEnd="url(#arrowhead)"
            />
          ))}
        </svg>

        {/* Components column */}
        <div className="z-10 w-80 flex-shrink-0 overflow-y-auto border-r border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Компоненты</h2>
            {editMode && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => addComponent("material")} title="Добавить материал">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => addComponent("eri")} title="Добавить ЭРИ">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {product.components.map((component) => (
              <ComponentCard
                key={component.id}
                component={component}
                batchSize={batchSize}
                expanded={expandedComponents.has(component.id)}
                editMode={editMode}
                onToggleExpand={() => toggleComponentExpanded(component.id)}
                onUpdateField={(key, value) => updateComponentField(component.id, key, value)}
                onUpdatePosition={(positionId, patch) => updatePosition(component.id, positionId, patch)}
                onAddPosition={() => addPosition(component.id)}
                onRemovePosition={(positionId) => removePosition(component.id, positionId)}
                onRemove={() => removeComponent(component.id)}
                ref={(el) => {
                  if (el) componentRefs.current.set(component.id, el);
                  else componentRefs.current.delete(component.id);
                }}
              />
            ))}
            {editMode && (
              <Button variant="outline" className="w-full" onClick={() => addComponent("fixture")}>
                <Plus className="mr-1 h-4 w-4" />
                Добавить оснастку
              </Button>
            )}
          </div>
        </div>

        {/* Operations row */}
        <div className="z-10 flex-1 overflow-x-auto overflow-y-hidden bg-background p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Операции</h2>
            {editMode && (
              <Button variant="outline" size="sm" onClick={addOperation}>
                <Plus className="mr-1 h-4 w-4" />
                Добавить операцию
              </Button>
            )}
          </div>

          <div className="flex min-h-[28rem] items-center gap-8">
            {sortedOperations.map((operation, idx) => (
              <OperationCard
                key={operation.id}
                operation={operation}
                result={operationResultMap.get(operation.id)}
                batchSize={batchSize}
                editMode={editMode}
                allComponents={product.components}
                isFirst={idx === 0}
                isLast={idx === sortedOperations.length - 1}
                onUpdateField={(key, value) => updateOperationField(operation.id, key, value)}
                onToggleInput={(componentId) => toggleOperationInput(operation.id, componentId)}
                onMoveUp={() => moveOperation(operation.id, -1)}
                onMoveDown={() => moveOperation(operation.id, 1)}
                onRemove={() => removeOperation(operation.id)}
                ref={(el) => {
                  if (el) operationRefs.current.set(operation.id, el);
                  else operationRefs.current.delete(operation.id);
                }}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

interface ComponentCardProps {
  component: ComponentGroup;
  batchSize: number;
  expanded: boolean;
  editMode: boolean;
  onToggleExpand: () => void;
  onUpdateField: <K extends keyof ComponentGroup>(key: K, value: ComponentGroup[K]) => void;
  onUpdatePosition: (positionId: string, patch: Partial<Position>) => void;
  onAddPosition: () => void;
  onRemovePosition: (positionId: string) => void;
  onRemove: () => void;
}

const ComponentCard = ({
  component,
  batchSize,
  expanded,
  editMode,
  onToggleExpand,
  onUpdateField,
  onUpdatePosition,
  onAddPosition,
  onRemovePosition,
  onRemove,
}: ComponentCardProps) => {
  const isEri = component.type === "eri";
  const isFixture = component.type === "fixture";
  const isSemi = component.type === "semi-product";
  const hasMultiplePositions = component.positions.length > 1;
  const isExpanded = expanded || hasMultiplePositions || isEri || editMode;
  const shortages = getShortageForBatch(component, batchSize);
  const isShortForBatch = shortages.length > 0;

  return (
    <Card
      className={cn(
        "relative border transition-shadow",
        isShortForBatch && !isSemi && !isFixture && "border-status-warn/60",
      )}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {editMode ? (
              <Input
                value={component.name}
                onChange={(e) => onUpdateField("name", e.target.value)}
                className="h-7 px-1 text-sm font-medium"
              />
            ) : (
              <CardTitle className="text-sm font-medium">{component.name}</CardTitle>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <Badge variant="secondary" className={cn("text-xs", COMPONENT_TYPE_COLORS[component.type])}>
                {COMPONENT_TYPE_LABELS[component.type]}
              </Badge>
              {isFixture && (
                <Badge variant="outline" className="text-xs">
                  {component.isShared ? "общая" : "на изделие"}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hasMultiplePositions && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleExpand}>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
            {editMode && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onRemove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 p-3 pt-0">
        {isSemi && (
          <CardDescription className="text-xs">
            Продукт этапа «{component.producedByOperationId ? `операция ${component.producedByOperationId}` : "—"}»
          </CardDescription>
        )}

        {isFixture && editMode && (
          <div className="flex items-center gap-2">
            <Label className="text-xs">Количество</Label>
            <Input
              type="number"
              min={0}
              value={component.fixtureCount ?? 1}
              onChange={(e) => onUpdateField("fixtureCount", Math.max(0, Number(e.target.value)))}
              className="h-7 w-20"
            />
            <Switch
              checked={component.isShared}
              onCheckedChange={(v) => onUpdateField("isShared", v)}
            />
            <Label className="text-xs">Общая</Label>
          </div>
        )}

        {!isFixture && !isSemi && (
          <div className="space-y-2">
            {(isExpanded || component.positions.length <= 1) && (
              <>
                {component.positions.map((position) => (
                  <div
                    key={position.id}
                    className={cn(
                      "rounded-md border p-2 text-xs",
                      position.stock < position.quantityPerUnit * batchSize
                        ? "border-status-warn/40 bg-status-warn/5"
                        : "border-border bg-background",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {editMode ? (
                        <Input
                          value={position.name}
                          onChange={(e) => onUpdatePosition(position.id, { name: e.target.value })}
                          className="h-6 px-1 text-xs"
                        />
                      ) : (
                        <span className="font-medium">{position.name}</span>
                      )}
                      {editMode && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-destructive"
                          onClick={() => onRemovePosition(position.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Норма</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.001"
                          value={position.quantityPerUnit}
                          onChange={(e) =>
                            onUpdatePosition(position.id, { quantityPerUnit: Number(e.target.value) })
                          }
                          className="h-6 px-1 text-xs"
                          disabled={!editMode}
                          readOnly={!editMode}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Остаток</Label>
                        <Input
                          type="number"
                          min={0}
                          value={position.stock}
                          onChange={(e) => onUpdatePosition(position.id, { stock: Number(e.target.value) })}
                          className={cn(
                            "h-6 px-1 text-xs",
                            position.stock < position.quantityPerUnit * batchSize && "border-status-warn",
                          )}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Срок поставки</Label>
                        <Input
                          type="number"
                          min={0}
                          value={position.leadTimeDays}
                          onChange={(e) =>
                            onUpdatePosition(position.id, { leadTimeDays: Number(e.target.value) })
                          }
                          className="h-6 px-1 text-xs"
                          disabled={!editMode}
                          readOnly={!editMode}
                        />
                      </div>
                    </div>
                    {!editMode && position.leadTimeDays > 0 && (
                      <div className="mt-1 text-[10px] text-muted-foreground">поставка: {position.leadTimeDays} дн.</div>
                    )}
                  </div>
                ))}
              </>
            )}
            {editMode && (
              <Button variant="ghost" size="sm" className="h-7 w-full text-xs" onClick={onAddPosition}>
                <Plus className="mr-1 h-3 w-3" />
                Добавить позицию
              </Button>
            )}
            {!editMode && isShortForBatch && (
              <div className="text-xs text-status-warn">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                Не хватает для {batchSize} шт.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface OperationCardProps {
  operation: Operation;
  result: ReturnType<ReturnType<typeof computeProductCalculations>["operationResults"]["find"]>; // undefined | result
  batchSize: number;
  editMode: boolean;
  allComponents: ComponentGroup[];
  isFirst: boolean;
  isLast: boolean;
  onUpdateField: <K extends keyof Operation>(key: K, value: Operation[K]) => void;
  onToggleInput: (componentId: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

const OperationCard = ({
  operation,
  result,
  batchSize,
  editMode,
  allComponents,
  isFirst,
  isLast,
  onUpdateField,
  onToggleInput,
  onMoveUp,
  onMoveDown,
  onRemove,
}: OperationCardProps) => {
  const canComplete = result?.canCompleteUnits ?? 0;
  const isLimited = canComplete < batchSize;
  const isBlocked = canComplete === 0;
  const isBottleneck = !!result && canComplete < batchSize;

  const availableInputComponents = allComponents.filter(
    (c) => c.type !== "semi-product" || operation.inputComponentIds.includes(c.id),
  );

  return (
    <Card
      className={cn(
        "relative z-10 w-64 flex-shrink-0 border-2 transition-colors",
        isBlocked
          ? "border-status-danger/60 bg-status-danger/5"
          : isBottleneck
            ? "border-status-warn/60 bg-status-warn/5"
            : "border-border bg-card",
      )}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {editMode ? (
              <Input
                value={operation.name}
                onChange={(e) => onUpdateField("name", e.target.value)}
                className="h-7 px-1 text-sm font-medium"
              />
            ) : (
              <CardTitle className="text-sm font-medium">{operation.name}</CardTitle>
            )}
          </div>
          {editMode && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={isFirst}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={isLast}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onRemove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <UserCircle className="h-3 w-3" />
          {editMode ? (
            <Input
              value={operation.responsible}
              onChange={(e) => onUpdateField("responsible", e.target.value)}
              className="h-6 px-1 text-xs"
              placeholder="Ответственный"
            />
          ) : (
            <span>{operation.responsible || "—"}</span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-2 text-xs">
          <Clock className="h-3 w-3 text-muted-foreground" />
          {editMode ? (
            <Input
              type="number"
              min={0}
              step="0.5"
              value={operation.durationHours}
              onChange={(e) => onUpdateField("durationHours", Number(e.target.value))}
              className="h-6 w-20 px-1 text-xs"
            />
          ) : (
            <span>{operation.durationHours} ч</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <div className="mb-2 flex items-center justify-between">
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              isBlocked
                ? "bg-status-danger text-status-danger-foreground"
                : isBottleneck
                  ? "bg-status-warn text-status-warn-foreground"
                  : "bg-status-ok text-status-ok-foreground",
            )}
          >
            {canComplete} / {batchSize} шт.
          </Badge>
          {result && (
            <span className="text-xs text-muted-foreground">
              {result.limitedBy.type === "component" ? "материал" : "предыдущий этап"}
            </span>
          )}
        </div>

        {editMode && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Входные компоненты:</div>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {availableInputComponents.map((component) => {
                const checked = operation.inputComponentIds.includes(component.id);
                return (
                  <label
                    key={component.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-1.5 hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleInput(component.id)}
                      className="h-3.5 w-3.5 rounded border-border text-primary"
                    />
                    <span className="text-xs">{component.name}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {COMPONENT_TYPE_LABELS[component.type]}
                    </Badge>
                  </label>
                );
              })}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Продукт этапа</Label>
              <select
                value={operation.outputComponentId ?? ""}
                onChange={(e) => onUpdateField("outputComponentId", e.target.value || null)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
              >
                <option value="">Нет (продолжение предыдущего)</option>
                {allComponents
                  .filter((c) => c.type === "semi-product")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
