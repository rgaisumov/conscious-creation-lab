import type {
  ComponentGroup,
  Operation,
  OperationComputed,
  OperationShortage,
  OperationVisualStatus,
  Product,
  Summary,
} from "./types";

/** Available "units" of a component (materials/ERI: stock/quantityPerUnit; fixtures: unlimited when shared; semi-products handled by upstream op). */
function componentUnitsAvailable(component: ComponentGroup): number {
  if (component.type === "semi-product") return Infinity;
  if (component.type === "fixture") {
    if (component.isShared) return Infinity;
    return component.fixtureCount ?? 0;
  }
  let min = Infinity;
  for (const p of component.positions) {
    if (p.quantityPerUnit <= 0) continue;
    const av = Math.floor(p.stock / p.quantityPerUnit);
    if (av < min) min = av;
  }
  return min === Infinity ? 0 : min;
}

function maxLeadTime(component: ComponentGroup): number {
  let m = 0;
  for (const p of component.positions) if (p.leadTimeDays > m) m = p.leadTimeDays;
  return m;
}

export function computeSummary(product: Product): Summary {
  const { batchSize, operations, components } = product;
  const compById = new Map(components.map((c) => [c.id, c]));
  const opById = new Map(operations.map((o) => [o.id, o]));
  const sorted = [...operations].sort((a, b) => a.order - b.order);

  // Available "flow units" for each semi-product = completedUnits of producing operation minus consumption by ops that consume it (we approximate: cap at producer.completed).
  // For simplicity: semi-product availability at any op = producer.completed - completedUnits of THIS op (assumes linear chain).
  const computedList: OperationComputed[] = [];
  const computedById = new Map<string, OperationComputed>();

  for (const op of sorted) {
    const shortages: OperationShortage[] = [];
    const requirements: OperationComputed["requirements"] = [];
    let capacity = batchSize - op.completedUnits;
    let waitingFor: OperationComputed["waitingFor"];

    for (const cid of op.inputComponentIds) {
      const c = compById.get(cid);
      if (!c) continue;

      let available: number;
      let required = batchSize;
      if (c.type === "semi-product") {
        const producerId = c.producedByOperationId;
        const producer = producerId ? opById.get(producerId) : undefined;
        const producerDone = producer ? producer.completedUnits : 0;
        available = producerDone - op.completedUnits;
        required = batchSize;
        if (available < capacity) {
          capacity = Math.max(0, available);
          if (producer) {
            waitingFor = {
              operationId: producer.id,
              operationName: producer.name,
              missing: Math.max(0, op.completedUnits + 1 - producerDone),
            };
          }
        }
      } else if (c.type === "fixture") {
        available = c.isShared ? Infinity : c.fixtureCount ?? 0;
        required = c.isShared ? 1 : batchSize;
        if (!c.isShared && available < capacity) {
          capacity = available;
          shortages.push({
            componentId: c.id,
            componentName: c.name,
            required,
            available,
            leadTimeDays: 0,
          });
        }
      } else {
        available = componentUnitsAvailable(c);
        const remainingNeed = batchSize - op.completedUnits;
        if (available < remainingNeed) {
          if (available < capacity) capacity = available;
          shortages.push({
            componentId: c.id,
            componentName: c.name,
            required: remainingNeed,
            available,
            leadTimeDays: maxLeadTime(c),
          });
        }
      }

      requirements.push({
        componentId: c.id,
        componentName: c.name,
        type: c.type,
        required: c.type === "fixture" && c.isShared ? 1 : batchSize,
        available: available === Infinity ? Number.POSITIVE_INFINITY : available,
        ok: available >= (c.type === "fixture" && c.isShared ? 1 : batchSize - op.completedUnits),
      });
    }

    capacity = Math.max(0, capacity);

    let status: OperationVisualStatus;
    let reason: string;
    const completed = op.completedUnits;
    const remaining = batchSize - completed;

    if (completed >= batchSize) {
      status = "done";
      reason = "Партия по этой операции завершена";
    } else if (completed > 0 && capacity > 0) {
      status = "running";
      reason = `Выполняется, можно продолжить на ${capacity} шт`;
    } else if (capacity === 0 && shortages.length > 0) {
      status = "blocked";
      const s = shortages[0];
      reason = `Не хватает: ${s.componentName} (${s.available}/${s.required})`;
    } else if (capacity === 0 && waitingFor) {
      status = "waiting";
      reason = `Ждёт: ${waitingFor.operationName}`;
    } else if (capacity > 0 && completed === 0) {
      status = "ready";
      reason = `Готова к запуску, можно ${capacity} шт`;
    } else {
      status = "waiting";
      reason = "Ожидание";
    }

    const c: OperationComputed = {
      operationId: op.id,
      completed,
      canPerformNow: capacity,
      remaining,
      status,
      reason,
      shortages,
      waitingFor,
      requirements,
    };
    computedList.push(c);
    computedById.set(op.id, c);
  }

  // Mark "next" — first non-blocked, non-done operation after a blocker
  const blockers = computedList.filter((c) => c.status === "blocked");
  if (blockers.length > 0) {
    for (const c of computedList) {
      if (c.status === "waiting" || c.status === "ready") {
        c.status = "next";
        break;
      }
    }
  }

  // Equipped = min consumable component units available (materials + eri) across the whole product
  let equipped = Infinity;
  for (const c of components) {
    if (c.type === "semi-product" || c.type === "fixture") continue;
    const av = componentUnitsAvailable(c);
    if (av < equipped) equipped = av;
  }
  if (equipped === Infinity) equipped = 0;
  equipped = Math.min(equipped, batchSize);

  const assembled = product.assembledOperationId
    ? opById.get(product.assembledOperationId)?.completedUnits ?? 0
    : 0;
  const tested = product.testedOperationId
    ? opById.get(product.testedOperationId)?.completedUnits ?? 0
    : 0;

  let fullBatchLeadDays = 0;
  for (const c of components) {
    if (c.type === "semi-product" || c.type === "fixture") continue;
    for (const p of c.positions) {
      const req = p.quantityPerUnit * batchSize;
      if (req > p.stock && p.leadTimeDays > fullBatchLeadDays) fullBatchLeadDays = p.leadTimeDays;
    }
  }
  const totalProductionDays = sorted.reduce((s, o) => s + o.durationHours / 24, 0);

  return {
    batchSize,
    equipped,
    assembled,
    tested,
    shipped: product.shippedUnits,
    blockers: computedList
      .filter((c) => c.status === "blocked")
      .map((c) => ({
        operationId: c.operationId,
        operationName: opById.get(c.operationId)!.name,
        reason: c.reason,
      })),
    operations: computedList,
    fullBatchLeadDays,
    totalProductionDays,
  };
}

export function operationById(product: Product, id: string): Operation | undefined {
  return product.operations.find((o) => o.id === id);
}
