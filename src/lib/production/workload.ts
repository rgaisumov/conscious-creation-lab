import type { Batch, Operation, Product, TransferTime, Workcenter } from "./types";

export const UNASSIGNED = "unassigned";
export const ORG_PREFIX = "org:";

/** Узел маршрута: внутренний участок или сторонняя организация. */
export function nodeOf(op: Operation): string {
  if (op.outsourceOrg && op.outsourceOrg.trim()) return `${ORG_PREFIX}${op.outsourceOrg.trim()}`;
  return op.workcenterId ?? UNASSIGNED;
}

export function isOutsourceNode(node: string) {
  return node.startsWith(ORG_PREFIX);
}

export function nodeLabel(node: string, workcenters: Workcenter[]): string {
  if (isOutsourceNode(node)) return `Аутсорс · ${node.slice(ORG_PREFIX.length)}`;
  if (node === UNASSIGNED) return "Без участка";
  return workcenters.find((w) => w.id === node)?.name ?? "Неизвестный участок";
}

export function transferHours(transfers: TransferTime[], from: string, to: string): number {
  if (from === to) return 0;
  return transfers.find((t) => t.fromNode === from && t.toNode === to)?.hours ?? 0;
}

export function sortedOperations(product: Product): Operation[] {
  return [...product.operations].sort((a, b) => a.order - b.order);
}

/** Пары «узел → узел», встречающиеся в маршрутах изделий. */
export function routeTransitions(products: Product[]): { from: string; to: string }[] {
  const seen = new Set<string>();
  const out: { from: string; to: string }[] = [];
  for (const p of products) {
    const ops = sortedOperations(p);
    for (let i = 1; i < ops.length; i++) {
      const from = nodeOf(ops[i - 1]!);
      const to = nodeOf(ops[i]!);
      if (from === to) continue;
      const key = `${from}>${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ from, to });
    }
  }
  return out;
}

/** Суммарное время транспортировки по маршруту изделия, часы на партию. */
export function routeTransferHours(product: Product, transfers: TransferTime[]): number {
  const ops = sortedOperations(product);
  let total = 0;
  for (let i = 1; i < ops.length; i++) {
    total += transferHours(transfers, nodeOf(ops[i - 1]!), nodeOf(ops[i]!));
  }
  return total;
}

export interface NodeLoad {
  node: string;
  label: string;
  outsource: boolean;
  /** Оставшиеся человеко-часы по всем активным партиям. */
  hours: number;
  /** Часы транспортировки, приходящие на этот узел. */
  transferHours: number;
  operations: number;
  batches: number;
}

/** Загрузка узлов по остатку активных партий. */
export function computeLoad(
  rows: { product: Product; batch: Batch }[],
  workcenters: Workcenter[],
  transfers: TransferTime[],
): NodeLoad[] {
  const map = new Map<string, NodeLoad>();
  const touched = new Map<string, Set<string>>();

  const ensure = (node: string) => {
    let e = map.get(node);
    if (!e) {
      e = {
        node,
        label: nodeLabel(node, workcenters),
        outsource: isOutsourceNode(node),
        hours: 0,
        transferHours: 0,
        operations: 0,
        batches: 0,
      };
      map.set(node, e);
      touched.set(node, new Set());
    }
    return e;
  };

  for (const w of workcenters) ensure(w.id);

  for (const { product, batch } of rows) {
    const ops = sortedOperations(product);
    ops.forEach((op, i) => {
      const node = nodeOf(op);
      const e = ensure(node);
      const remaining = Math.max(0, batch.orderedQty - (batch.completed[op.id] ?? 0));
      if (remaining > 0) {
        e.hours += remaining * op.durationHours;
        e.operations += 1;
        touched.get(node)!.add(batch.id);
      }
      if (i > 0) {
        const from = nodeOf(ops[i - 1]!);
        if (from !== node && remaining > 0) e.transferHours += transferHours(transfers, from, node);
      }
    });
  }

  for (const [node, set] of touched) map.get(node)!.batches = set.size;

  return [...map.values()].sort((a, b) => b.hours - a.hours);
}

/** Дополнительная нагрузка от планируемой партии. */
export function forecastLoad(
  product: Product,
  qty: number,
  workcenters: Workcenter[],
  transfers: TransferTime[],
): NodeLoad[] {
  const batch: Batch = {
    id: "forecast",
    productId: product.id,
    number: "forecast",
    orderedQty: Math.max(0, qty),
    shippedQty: 0,
    dueDate: "",
    completed: {},
  };
  return computeLoad([{ product, batch }], workcenters, transfers);
}

export function weeklyCapacity(w: Workcenter) {
  return Math.max(0, w.workers) * Math.max(0, w.hoursPerWorkerPerWeek);
}

/** Сколько рабочих нужно, чтобы закрыть `hours` за `weeks` недель. */
export function workersNeeded(hours: number, weeks: number, hoursPerWorkerPerWeek: number) {
  if (weeks <= 0 || hoursPerWorkerPerWeek <= 0) return 0;
  return Math.ceil(hours / (weeks * hoursPerWorkerPerWeek));
}
