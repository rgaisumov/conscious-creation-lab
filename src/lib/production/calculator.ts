import type {
  Batch,
  BatchHealth,
  ComponentGroup,
  Operation,
  OperationComputed,
  OperationGroupComputed,
  OperationRequirement,
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

export function completedOf(batch: Batch, operationId: string): number {
  return batch.completed[operationId] ?? 0;
}

export function computeSummary(product: Product, batch: Batch): Summary {
  const batchSize = batch.orderedQty;
  const { operations, components } = product;
  const compById = new Map(components.map((c) => [c.id, c]));
  const opById = new Map(operations.map((o) => [o.id, o]));
  const sorted = [...operations].sort((a, b) => a.order - b.order);

  const computedList: OperationComputed[] = [];

  for (const op of sorted) {
    const shortages: OperationShortage[] = [];
    const requirements: OperationRequirement[] = [];
    const opCompleted = completedOf(batch, op.id);
    const remainingNeed = batchSize - opCompleted;
    let capacity = remainingNeed;
    let waitingFor: OperationComputed["waitingFor"];

    for (const cid of op.inputComponentIds) {
      const c = compById.get(cid);
      if (!c) continue;

      let available: number;

      if (c.type === "semi-product") {
        const producerId = c.producedByOperationId;
        const producer = producerId ? opById.get(producerId) : undefined;
        const producerDone = producer ? completedOf(batch, producer.id) : 0;
        available = producerDone - opCompleted;
        if (available < capacity) {
          capacity = Math.max(0, available);
          if (producer) {
            waitingFor = {
              operationId: producer.id,
              operationName: producer.name,
              missing: Math.max(0, opCompleted + 1 - producerDone),
            };
          }
        }
      } else if (c.type === "fixture") {
        const count = c.fixtureCount ?? 0;
        available = count > 0 ? Infinity : 0;
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

    let status: OperationVisualStatus;
    let reason: string;

    if (opCompleted >= batchSize) {
      status = "done";
      reason = "Партия по этой операции завершена";
    } else if (shortages.length > 0) {
      status = "blocked";
      const s = shortages[0];
      reason = `Не хватает: ${s.componentName} (${s.available}/${s.required})`;
    } else if (capacity === 0 && waitingFor) {
      status = "waiting";
      reason = `Ждёт: ${waitingFor.operationName}`;
    } else if (opCompleted > 0 && capacity > 0) {
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
      completed: opCompleted,
      canPerformNow: capacity,
      remaining: batchSize - opCompleted,
      status,
      reason,
      shortages,
      waitingFor,
      requirements,
    });
  }

  // BT002: только самый ранний блокер — RED, последующие — ORANGE.
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

  // Группы операций (OG003) — агрегированный прогресс и худший статус.
  const severity: Record<OperationVisualStatus, number> = {
    blocked: 0,
    next: 1,
    waiting: 2,
    running: 3,
    ready: 4,
    done: 5,
  };
  const groups: OperationGroupComputed[] = product.operationGroups.map((g) => {
    const members = sorted.filter((o) => o.groupId === g.id);
    const memberComputed = members
      .map((m) => computedList.find((c) => c.operationId === m.id))
      .filter((c): c is OperationComputed => !!c);
    const worst = memberComputed.reduce<OperationComputed | undefined>(
      (acc, c) => (!acc || severity[c.status] < severity[acc.status] ? c : acc),
      undefined,
    );
    const last = memberComputed[memberComputed.length - 1];
    return {
      groupId: g.id,
      name: g.name,
      operationIds: members.map((m) => m.id),
      completed: last ? last.completed : 0,
      status: worst ? worst.status : "ready",
      reason: worst ? worst.reason : "",
    };
  });

  // «Укомплектовано» = min по всем расходуемым компонентам.
  let equipped = Infinity;
  for (const c of components) {
    if (c.type === "semi-product" || c.type === "fixture") continue;
    const av = componentUnitsAvailable(c);
    if (av < equipped) equipped = av;
  }
  if (equipped === Infinity) equipped = 0;
  equipped = Math.min(equipped, batchSize);

  const assembled = product.assembledOperationId ? completedOf(batch, product.assembledOperationId) : 0;
  const tested = product.testedOperationId ? completedOf(batch, product.testedOperationId) : 0;

  let fullBatchLeadDays = 0;
  for (const c of components) {
    if (c.type === "semi-product" || c.type === "fixture") continue;
    for (const p of c.positions) {
      const req = p.quantityPerUnit * batchSize;
      if (req > p.stock && p.leadTimeDays > fullBatchLeadDays) fullBatchLeadDays = p.leadTimeDays;
    }
  }
  const totalProductionDays = sorted.reduce((s, o) => s + o.durationHours / 24, 0);

  const blockers = computedList
    .filter((c) => c.status === "blocked" || c.status === "next")
    .map((c) => ({
      operationId: c.operationId,
      operationName: opById.get(c.operationId)!.name,
      reason: c.reason,
    }));

  const shipped = batch.shippedQty;
  const progressPct = batchSize > 0 ? Math.round((shipped / batchSize) * 100) : 0;

  const due = new Date(batch.dueDate).getTime();
  const today = Date.now();
  const daysToDue = Math.floor((due - today) / 86_400_000);
  const finished = shipped >= batchSize;
  const delayDays = !finished && daysToDue < 0 ? -daysToDue : 0;

  let health: BatchHealth;
  if (finished) health = "ok";
  else if (delayDays > 0) health = "late";
  else if (blockers.length > 0 || daysToDue <= 14) health = "risk";
  else health = "ok";

  const primaryBlockingReason = finished
    ? "Партия отгружена"
    : blockers.length > 0
      ? `${blockers[0].operationName} — ${blockers[0].reason}`
      : "Блокеров нет";

  return {
    batchSize,
    equipped,
    assembled,
    tested,
    shipped,
    blockers,
    operations: computedList,
    groups,
    fullBatchLeadDays,
    totalProductionDays,
    delayDays,
    health,
    progressPct,
    primaryBlockingReason,
  };
}

export function operationById(product: Product, id: string): Operation | undefined {
  return product.operations.find((o) => o.id === id);
}
