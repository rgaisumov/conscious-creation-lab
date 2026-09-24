import type { ServerState } from "./production.functions";

type Old = {
  products: { id: string; name: string; components: unknown; operations: unknown; operation_groups: unknown; archived: boolean }[];
  batches: {
    id: string;
    number: string;
    product_id: string;
    completed: unknown;
    shipped_qty: number;
    ordered_qty: number;
    due_date: string;
    route_override: unknown;
  }[];
  contracts: { id: string; number: string; counterparty: string }[];
  workcenters: { id: string; name: string; workers: number; hours_per_worker_per_week: number }[];
};

export type AuditEntry = { section: string; action: string; entity: string };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Сравнивает прежнее и новое состояние и формирует записи журнала. */
export function diffForAudit(old: Old, next: ServerState): AuditEntry[] {
  const out: AuditEntry[] = [];

  // Изделия
  const oldP = new Map(old.products.map((p) => [p.id, p]));
  for (const p of next.products) {
    const o = oldP.get(p.id);
    if (!o) {
      out.push({ section: "products", action: "Создано изделие", entity: p.name });
      continue;
    }
    if (o.name !== p.name) out.push({ section: "products", action: `Переименовано изделие: «${o.name}» → «${p.name}»`, entity: p.name });
    if (!same(o.components, p.components)) out.push({ section: "products", action: "Изменены компоненты изделия", entity: p.name });
    if (!same(o.operations, p.operations) || !same(o.operation_groups, p.operationGroups))
      out.push({ section: "products", action: "Изменён тех. маршрут изделия", entity: p.name });
    if (o.archived !== !!p.archived) out.push({ section: "products", action: p.archived ? "Изделие в архиве" : "Изделие из архива", entity: p.name });
  }
  for (const o of old.products) if (!next.products.some((p) => p.id === o.id)) out.push({ section: "products", action: "Удалено изделие", entity: o.name });

  // Партии
  const opName = (productId: string, batch: ServerState["batches"][number] | undefined, opId: string) => {
    const ops = batch?.routeOverride?.operations ?? next.products.find((p) => p.id === productId)?.operations ?? [];
    return ops.find((o) => o.id === opId)?.name ?? opId;
  };
  const oldB = new Map(old.batches.map((b) => [b.id, b]));
  for (const b of next.batches) {
    const o = oldB.get(b.id);
    const ent = `Партия ${b.number}`;
    if (!o) {
      out.push({ section: "production", action: "Создана партия", entity: ent });
      continue;
    }
    const oc = (o.completed ?? {}) as Record<string, number>;
    const keys = new Set([...Object.keys(oc), ...Object.keys(b.completed)]);
    for (const k of keys) {
      const a = oc[k] ?? 0;
      const c = b.completed[k] ?? 0;
      if (a !== c) out.push({ section: "production", action: `${opName(b.productId, b, k)}: ${a} → ${c} шт.`, entity: ent });
    }
    if (o.shipped_qty !== b.shippedQty) out.push({ section: "production", action: `Отгружено: ${o.shipped_qty} → ${b.shippedQty} шт.`, entity: ent });
    if (o.ordered_qty !== b.orderedQty) out.push({ section: "production", action: `Размер партии: ${o.ordered_qty} → ${b.orderedQty} шт.`, entity: ent });
    if (o.due_date !== b.dueDate) out.push({ section: "production", action: `Срок: ${o.due_date} → ${b.dueDate}`, entity: ent });
    if (!same(o.route_override, b.routeOverride)) out.push({ section: "production", action: "Изменён тех. маршрут партии", entity: ent });
  }
  for (const o of old.batches) if (!next.batches.some((b) => b.id === o.id)) out.push({ section: "production", action: "Удалена партия", entity: `Партия ${o.number}` });

  // Договоры (изменения внутри поставок фиксируются общей записью)
  const oldC = new Map(old.contracts.map((c) => [c.id, c]));
  for (const c of next.contracts) {
    const o = oldC.get(c.id);
    if (!o) out.push({ section: "contracts", action: "Создан договор", entity: c.number });
    else if (o.number !== c.number || o.counterparty !== c.counterparty)
      out.push({ section: "contracts", action: "Изменён договор", entity: c.number });
  }
  for (const o of old.contracts) if (!next.contracts.some((c) => c.id === o.id)) out.push({ section: "contracts", action: "Удалён договор", entity: o.number });

  // Участки
  const oldW = new Map(old.workcenters.map((w) => [w.id, w]));
  for (const w of next.workcenters) {
    const o = oldW.get(w.id);
    if (!o) out.push({ section: "workcenters", action: "Создан участок", entity: w.name });
    else if (o.name !== w.name || o.workers !== w.workers || o.hours_per_worker_per_week !== w.hoursPerWorkerPerWeek)
      out.push({ section: "workcenters", action: "Изменён участок", entity: w.name });
  }
  for (const o of old.workcenters) if (!next.workcenters.some((w) => w.id === o.id)) out.push({ section: "workcenters", action: "Удалён участок", entity: o.name });

  return out;
}
