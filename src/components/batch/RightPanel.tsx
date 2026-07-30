import { X } from "lucide-react";
import { useProduction } from "@/lib/production/store";
import { useWorkspace } from "@/lib/production/workspace";
import { componentUnitsAvailable } from "@/lib/production/calculator";
import { AVAILABILITY_CHIP, AVAILABILITY_DOT, AVAILABILITY_RANK, STATUS_META, fmtQty } from "./status";

export function RightPanel() {
  const { product, batch, summary, selection, select } = useWorkspace();
  const { setCompleted } = useProduction();

  if (!selection) {
    return (
      <aside className="hidden w-80 shrink-0 border-l border-border bg-card/40 p-4 xl:block">
        <p className="text-xs text-muted-foreground">
          Выберите операцию или компонент, чтобы увидеть детали: причину задержки, требования и остатки.
        </p>
      </aside>
    );
  }

  if (selection.kind === "operation") {
    const op = product.operations.find((o) => o.id === selection.id);
    const oc = summary.operations.find((o) => o.operationId === selection.id);
    if (!op || !oc) return null;
    const meta = STATUS_META[oc.status];
    const reqs = [...oc.requirements].sort(
      (a, b) => AVAILABILITY_RANK[a.availability] - AVAILABILITY_RANK[b.availability],
    );

    return (
      <aside className="w-80 shrink-0 overflow-auto border-l border-border bg-card/40 p-4">
        <PanelHeader title={op.name} onClose={() => select(null)} />
        <span className={`inline-block rounded border px-2 py-0.5 text-[11px] ${meta.badge}`}>{meta.label}</span>
        <p className="mt-2 text-xs text-muted-foreground">{oc.reason}</p>

        <dl className="mt-4 space-y-1.5 text-xs">
          <Row label="Ответственный" value={op.responsible} />
          <Row label="Длительность" value={`${op.durationHours} ч`} />
          <Row label="Выполнено" value={`${oc.completed}/${summary.batchSize}`} />
          <Row label="Можно сейчас" value={`${oc.canPerformNow} шт`} />
        </dl>

        <div className="mt-4">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Отметить выполнено, шт
          </label>
          <input
            type="number"
            min={0}
            max={summary.batchSize}
            value={oc.completed}
            onChange={(e) => setCompleted(batch.id, op.id, Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>

        <h3 className="mt-5 text-[10px] uppercase tracking-wide text-muted-foreground">Требуется</h3>
        <ul className="mt-2 space-y-1.5">
          {reqs.map((r) => (
            <li
              key={r.componentId}
              className={`flex items-center justify-between rounded border px-2 py-1.5 text-xs ${AVAILABILITY_CHIP[r.availability]}`}
            >
              <span className="truncate">{r.componentName}</span>
              <span className="ml-2 shrink-0 tabular-nums">
                {fmtQty(r.available)}/{fmtQty(r.required)}
              </span>
            </li>
          ))}
          {reqs.length === 0 && <li className="text-xs text-muted-foreground">Входов нет</li>}
        </ul>
      </aside>
    );
  }

  const comp = product.components.find((c) => c.id === selection.id);
  if (!comp) return null;
  const units = componentUnitsAvailable(comp);
  const availability = units >= summary.batchSize ? "full" : units > 0 ? "partial" : "none";
  const consumers = product.operations.filter((o) => o.inputComponentIds.includes(comp.id));

  return (
    <aside className="w-80 shrink-0 overflow-auto border-l border-border bg-card/40 p-4">
      <PanelHeader title={comp.name} onClose={() => select(null)} />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${AVAILABILITY_DOT[availability]}`} />
        Хватает на {fmtQty(units)} из {summary.batchSize} шт
      </div>

      {comp.type === "fixture" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Оснастка не расходуется: {comp.fixtureCount ?? 0} шт в наличии.
        </p>
      )}

      {comp.positions.length > 0 && (
        <>
          <h3 className="mt-5 text-[10px] uppercase tracking-wide text-muted-foreground">Позиции</h3>
          <ul className="mt-2 space-y-1.5">
            {comp.positions.map((p) => (
              <li key={p.id} className="rounded border border-border bg-background px-2 py-1.5 text-xs">
                <div className="font-medium text-foreground">{p.name}</div>
                <div className="mt-0.5 text-muted-foreground">
                  запас {p.stock} · норма {p.quantityPerUnit}/шт · поставка {p.leadTimeDays} дн
                  {p.supplier ? ` · ${p.supplier}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mt-5 text-[10px] uppercase tracking-wide text-muted-foreground">Используется в</h3>
      <ul className="mt-2 space-y-1">
        {consumers.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => select({ kind: "operation", id: o.id })}
              className="w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            >
              {o.name}
            </button>
          </li>
        ))}
        {consumers.length === 0 && <li className="text-xs text-muted-foreground">Нет операций</li>}
      </ul>
    </aside>
  );
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
