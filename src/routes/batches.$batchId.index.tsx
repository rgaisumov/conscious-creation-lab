import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useWorkspace } from "@/lib/production/workspace";
import { AVAILABILITY_CHIP, AVAILABILITY_RANK, STATUS_META, fmtQty } from "@/components/batch/status";
import type { OperationComputed } from "@/lib/production/types";

export const Route = createFileRoute("/batches/$batchId/")({
  component: TechRoutePage,
});

function TechRoutePage() {
  const { product, summary, selection, select } = useWorkspace();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const sorted = [...product.operations].sort((a, b) => a.order - b.order);
  const computedById = new Map(summary.operations.map((o) => [o.operationId, o]));

  // Собираем ленту: одиночные операции и свёрнутые группы (OG003).
  type Item =
    | { kind: "op"; opId: string }
    | { kind: "group"; groupId: string };
  const items: Item[] = [];
  const seenGroups = new Set<string>();
  for (const op of sorted) {
    if (op.groupId) {
      if (seenGroups.has(op.groupId)) continue;
      seenGroups.add(op.groupId);
      items.push({ kind: "group", groupId: op.groupId });
    } else {
      items.push({ kind: "op", opId: op.id });
    }
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl space-y-3">
        {items.map((item, idx) => {
          if (item.kind === "op") {
            const oc = computedById.get(item.opId);
            const op = sorted.find((o) => o.id === item.opId)!;
            if (!oc) return null;
            return (
              <div key={item.opId}>
                <OperationCard
                  index={idx + 1}
                  name={op.name}
                  responsible={op.responsible}
                  oc={oc}
                  batchSize={summary.batchSize}
                  active={selection?.kind === "operation" && selection.id === op.id}
                  onSelect={() => select({ kind: "operation", id: op.id })}
                  onSelectComponent={(id) => select({ kind: "component", id })}
                />
                {idx < items.length - 1 && <Connector />}
              </div>
            );
          }

          const g = summary.groups.find((x) => x.groupId === item.groupId);
          if (!g) return null;
          const open = openGroups[g.groupId] ?? false;
          const meta = STATUS_META[g.status];
          return (
            <div key={g.groupId}>
              <div className={`rounded-lg border border-border border-l-4 bg-card ${meta.ring}`}>
                <button
                  type="button"
                  onClick={() => setOpenGroups((s) => ({ ...s, [g.groupId]: !open }))}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
                  <span className="flex-1 text-sm font-medium text-card-foreground">
                    {g.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {g.operationIds.length} операций
                    </span>
                  </span>
                  <span className={`rounded border px-2 py-0.5 text-[11px] ${meta.badge}`}>{meta.short}</span>
                </button>
                {open && (
                  <div className="space-y-2 border-t border-border p-3">
                    {g.operationIds.map((opId, i) => {
                      const oc = computedById.get(opId);
                      const op = sorted.find((o) => o.id === opId);
                      if (!oc || !op) return null;
                      return (
                        <OperationCard
                          key={opId}
                          index={`${idx + 1}.${i + 1}`}
                          name={op.name}
                          responsible={op.responsible}
                          oc={oc}
                          batchSize={summary.batchSize}
                          active={selection?.kind === "operation" && selection.id === op.id}
                          onSelect={() => select({ kind: "operation", id: op.id })}
                          onSelectComponent={(id) => select({ kind: "component", id })}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
              {idx < items.length - 1 && <Connector />}
            </div>
          );
        })}

        <Legend />
      </div>
    </div>
  );
}

function Connector() {
  return <div className="mx-auto my-1 h-4 w-px bg-border" />;
}

function OperationCard({
  index,
  name,
  responsible,
  oc,
  batchSize,
  active,
  onSelect,
  onSelectComponent,
}: {
  index: number | string;
  name: string;
  responsible: string;
  oc: OperationComputed;
  batchSize: number;
  active: boolean;
  onSelect: () => void;
  onSelectComponent: (id: string) => void;
}) {
  const meta = STATUS_META[oc.status];
  const pct = batchSize > 0 ? Math.round((oc.completed / batchSize) * 100) : 0;
  const reqs = [...oc.requirements].sort(
    (a, b) => AVAILABILITY_RANK[a.availability] - AVAILABILITY_RANK[b.availability],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={`cursor-pointer rounded-lg border border-l-4 bg-card p-4 transition-colors ${meta.ring} ${
        active ? "border-primary" : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-xs text-muted-foreground tabular-nums">{index}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-card-foreground">{name}</span>
            <span className={`rounded border px-2 py-0.5 text-[11px] ${meta.badge}`}>{meta.short}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {responsible} · {oc.reason}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
              <div className={`h-full ${meta.bar}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {oc.completed}/{batchSize}
            </span>
          </div>

          {reqs.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {reqs.map((r) => (
                <button
                  key={r.componentId}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectComponent(r.componentId);
                  }}
                  className={`rounded border px-2 py-0.5 text-[11px] ${AVAILABILITY_CHIP[r.availability]}`}
                >
                  {r.componentName} {fmtQty(r.available)}/{fmtQty(r.required)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend() {
  const order = ["blocked", "next", "waiting", "ready", "running", "done"] as const;
  return (
    <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-4 text-[11px] text-muted-foreground">
      {order.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${STATUS_META[k].dot}`} />
          {STATUS_META[k].short}
        </span>
      ))}
    </div>
  );
}
