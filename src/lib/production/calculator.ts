import type {
  ComponentGroup,
  Operation,
  OperationComputed,
  OperationShortage,
  OperationVisualStatus,
  Product,
  Summary,
} from "./types";

/** Available "units" of a component. */
export function componentUnitsAvailable(component: ComponentGroup): number {
  if (component.type === "semi-product") return Infinity;
  if (component.type === "fixture") {
    return (component.fixtureCount ?? 0) > 0 ? Infinity : 0;
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

  const computedList: OperationComputed[] = [];

  for (const op of sorted) {
    const shortages: OperationShortage[] = [];
    const requirements: OperationComputed["requirements"] = [];
    const remainingNeed = batchSize - op.completedUnits;
    let capacity = remainingNeed;
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
        const count = c.fixtureCount ?? 0;
        available = count > 0 ? Infinity : 0;
        required = 1;
        if (available === 0) {
          capacity = 0;
          shortages.push({
            componentId: c.id,
            componentName: c.name,
            required: 1,
            available: 0,
            leadTimeDays: 0,
          });
        }
      } else {
        available = componentUnitsAvailable(c);
        required = remainingNeed;
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

      const reqValueForOk = c.type === "fixture" ? 1 : remainingNeed;
      const reqForStatus = c.type === "fixture" ? 1 : batchSize;
      const availForStatus = available === Infinity ? Number.POSITIVE_INFINITY : available;
      let availability: "full" | "partial" | "none";
      if (availForStatus >= reqForStatus) availability = "full";
      else if (availForStatus > 0) availability = "partial";
      else availability = "none";
      requirements.push({
        componentId: c.id,
        componentName: c.name,
        type: c.type,
        required: reqForStatus,
        available: availForStatus,
        ok: available >= reqValueForOk,
        availability,
      });
    }

    capacity = Math.max(0, capacity);

    // Status semantics:
    //  done    — партия выполнена
    //  blocked — есть собственная нехватка (даже если и upstream мешает)
    //  waiting — только ждёт предыдущую операцию
    //  running — идёт и можно продолжать
    //  ready   — не начата, но можно запускать
    let status: OperationVisualStatus;
    let reason: string;
    const completed = op.completedUnits;

    if (completed >= batchSize) {
      status = "done";
      reason = "Партия по этой операции завершена";
    } else if (shortages.length > 0) {
      status = "blocked";
      const s = shortages[0];
      reason = `Не хватает: ${s.componentName} (${s.available}/${s.required})`;
    } else if (capacity === 0 && waitingFor) {
      status = "waiting";
      reason = `Ждёт: ${waitingFor.operationName}`;
    } else if (completed > 0 && capacity > 0) {
      status = "running";
      reason = `Выполняется, можно продолжить на ${capacity} шт`;
    } else if (capacity > 0) {
      status = "ready";
      reason = `Готова к запуску, можно ${capacity} шт`;
    } else {
      status = "waiting";
      reason = "Ожидание";
    }

    computedList.push({
      operationId: op.id,
      completed,
      canPerformNow: capacity,
      remaining: batchSize - completed,
      status,
      reason,
      shortages,
      waitingFor,
      requirements,
    });
  }

  // Chain semantics: only the earliest blocked operation stays RED,
  // subsequent blocked ones downgrade to ORANGE ("next problem").
  let sawBlocker = false;
  for (const c of computedList) {
    if (c.status === "blocked") {
      if (sawBlocker) {
        c.status = "next";
        c.reason = `Следующая проблема · ${c.reason}`;
      } else {
        sawBlocker = true;
      }
    }
  }


  // «Укомплектовано» = min по всем расходуемым компонентам (materials + eri).
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
