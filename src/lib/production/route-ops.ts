import type { ComponentGroup, ComponentType, Operation, OperationGroup } from "./types";

/** Editable part of manufacturing knowledge, shared by product template and batch override. */
export interface RouteDraft {
  components: ComponentGroup[];
  operations: Operation[];
  operationGroups: OperationGroup[];
}

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

function reorder(ops: Operation[]): Operation[] {
  return ops.map((o, i) => ({ ...o, order: i + 1 }));
}

export function sortedOps(route: RouteDraft): Operation[] {
  return [...route.operations].sort((a, b) => a.order - b.order);
}

/** Insert a new operation at position `index` (0-based) in the sorted list. */
export function addOperation(route: RouteDraft, index: number): RouteDraft {
  const ops = sortedOps(route);
  const op: Operation = {
    id: uid("op"),
    name: "Новая операция",
    responsible: "—",
    durationHours: 4,
    order: 0,
    inputComponentIds: [],
    outputComponentId: null,
  };
  const i = Math.max(0, Math.min(ops.length, index));
  ops.splice(i, 0, op);
  return { ...route, operations: reorder(ops) };
}

export function updateOperation(route: RouteDraft, opId: string, patch: Partial<Operation>): RouteDraft {
  return {
    ...route,
    operations: route.operations.map((o) => (o.id === opId ? { ...o, ...patch } : o)),
  };
}

export function removeOperation(route: RouteDraft, opId: string): RouteDraft {
  const ops = sortedOps(route).filter((o) => o.id !== opId);
  return {
    ...route,
    operations: reorder(ops).map((o) => ({
      ...o,
      inputComponentIds: o.inputComponentIds.filter((cid) => {
        const c = route.components.find((x) => x.id === cid);
        return !(c?.type === "semi-product" && c.producedByOperationId === opId);
      }),
    })),
    components: route.components.filter(
      (c) => !(c.type === "semi-product" && c.producedByOperationId === opId),
    ),
  };
}

export function moveOperation(route: RouteDraft, opId: string, dir: -1 | 1): RouteDraft {
  const ops = sortedOps(route);
  const i = ops.findIndex((o) => o.id === opId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ops.length) return route;
  const copy = [...ops];
  const a = copy[i]!;
  const b = copy[j]!;
  copy[i] = b;
  copy[j] = a;
  return { ...route, operations: reorder(copy) };
}

export function toggleInput(route: RouteDraft, opId: string, componentId: string): RouteDraft {
  return {
    ...route,
    operations: route.operations.map((o) =>
      o.id !== opId
        ? o
        : {
            ...o,
            inputComponentIds: o.inputComponentIds.includes(componentId)
              ? o.inputComponentIds.filter((c) => c !== componentId)
              : [...o.inputComponentIds, componentId],
          },
    ),
  };
}

/**
 * Link operation `fromId` -> `toId` through a semi-product (graph edge).
 * Creates the semi-product component if the source has none.
 */
export function linkOperations(route: RouteDraft, fromId: string, toId: string): RouteDraft {
  const from = route.operations.find((o) => o.id === fromId);
  const to = route.operations.find((o) => o.id === toId);
  if (!from || !to || fromId === toId) return route;

  let next = route;
  let semiId = from.outputComponentId;
  const existing = semiId ? next.components.find((c) => c.id === semiId) : undefined;
  if (!existing || existing.type !== "semi-product") {
    semiId = uid("semi");
    next = {
      ...next,
      components: [
        ...next.components,
        {
          id: semiId,
          name: `Полуфабрикат: ${from.name}`,
          type: "semi-product",
          positions: [],
          producedByOperationId: fromId,
        },
      ],
    };
    next = updateOperation(next, fromId, { outputComponentId: semiId });
  }
  const sid = semiId!;
  if (to.inputComponentIds.includes(sid)) return next;
  return updateOperation(next, toId, { inputComponentIds: [...to.inputComponentIds, sid] });
}

/** Remove the semi-product edge between two operations. */
export function unlinkOperations(route: RouteDraft, fromId: string, toId: string): RouteDraft {
  const to = route.operations.find((o) => o.id === toId);
  if (!to) return route;
  const semiIds = route.components
    .filter((c) => c.type === "semi-product" && c.producedByOperationId === fromId)
    .map((c) => c.id);
  return updateOperation(route, toId, {
    inputComponentIds: to.inputComponentIds.filter((c) => !semiIds.includes(c)),
  });
}

export function addComponent(route: RouteDraft, type: ComponentType): RouteDraft {
  const id = uid("comp");
  const label: Record<ComponentType, string> = {
    material: "Новый материал",
    eri: "Новое ЭРИ",
    fixture: "Новая оснастка",
    detail: "Новая деталь",
    assembly: "Новая сборочная единица",
    standard: "Новое стандартное изделие",
    packaging: "Новая упаковка",
    "semi-product": "Новый полуфабрикат",
  };
  const c: ComponentGroup = {
    id,
    name: label[type],
    type,
    positions:
      type === "semi-product" || type === "fixture"
        ? []
        : [{ id: uid("pos"), name: "Позиция 1", quantityPerUnit: 1, stock: 0, leadTimeDays: 14 }],
    ...(type === "fixture" ? { fixtureCount: 1 } : {}),
  };
  return { ...route, components: [...route.components, c] };
}

export function updateComponent(
  route: RouteDraft,
  componentId: string,
  patch: Partial<ComponentGroup>,
): RouteDraft {
  return {
    ...route,
    components: route.components.map((c) => (c.id === componentId ? { ...c, ...patch } : c)),
  };
}

export function removeComponent(route: RouteDraft, componentId: string): RouteDraft {
  return {
    ...route,
    components: route.components.filter((c) => c.id !== componentId),
    operations: route.operations.map((o) => ({
      ...o,
      inputComponentIds: o.inputComponentIds.filter((c) => c !== componentId),
      outputComponentId: o.outputComponentId === componentId ? null : o.outputComponentId,
    })),
  };
}

export function cloneRoute(route: RouteDraft): RouteDraft {
  return JSON.parse(JSON.stringify(route)) as RouteDraft;
}

/**
 * BOM-нормализация: каждый атомарный компонент — одна строка спецификации
 * (ровно одна запись в positions). Группы с несколькими позициями
 * разбиваются на отдельные компоненты; ссылки операций переносятся.
 */
export function normalizeRoute<T extends RouteDraft>(route: T): T {
  const replace = new Map<string, string[]>();
  const components: ComponentGroup[] = [];
  for (const c of route.components) {
    if (c.type === "semi-product" || c.type === "fixture" || c.type === "assembly") {
      components.push(c);
      continue;
    }
    if (c.positions.length <= 1) {
      const p = c.positions[0];
      components.push({
        ...c,
        positions: [p ? { ...p, name: c.name } : { id: uid("pos"), name: c.name, quantityPerUnit: 1, stock: 0, leadTimeDays: 0 }],
      });
      continue;
    }
    const ids: string[] = [];
    c.positions.forEach((p, i) => {
      const id = i === 0 ? c.id : uid("comp");
      ids.push(id);
      components.push({ ...c, id, name: p.name, positions: [{ ...p }] });
    });
    replace.set(c.id, ids);
  }
  if (replace.size === 0 && components.every((c, i) => c === route.components[i])) return route;
  return {
    ...route,
    components,
    operations: route.operations.map((o) => ({
      ...o,
      inputComponentIds: o.inputComponentIds.flatMap((id) => replace.get(id) ?? [id]),
    })),
  };
}
