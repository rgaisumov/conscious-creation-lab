export type ComponentType = "material" | "eri" | "fixture" | "semi-product";

export interface Position {
  id: string;
  name: string;
  quantityPerUnit: number;
  stock: number;
  leadTimeDays: number;
  supplier?: string;
  note?: string;
}

export interface ComponentGroup {
  id: string;
  name: string;
  type: ComponentType;
  positions: Position[];
  isShared?: boolean;
  fixtureCount?: number;
  producedByOperationId?: string | null;
  note?: string;
}

export interface Operation {
  id: string;
  name: string;
  responsible: string;
  durationHours: number;
  order: number;
  inputComponentIds: string[];
  outputComponentId: string | null;
  /** Optional OperationGroup id (OG001) */
  groupId?: string;
  note?: string;
}

/** Logical stage grouping several independent operations (OG001-OG003). */
export interface OperationGroup {
  id: string;
  name: string;
}

/** Product stores manufacturing knowledge (PM001). */
export interface Product {
  id: string;
  name: string;
  version: string;
  note?: string;
  archived?: boolean;
  assembledOperationId?: string;
  testedOperationId?: string;
  components: ComponentGroup[];
  operations: Operation[];
  operationGroups: OperationGroup[];
}

/** Batch stores manufacturing execution (PM001, BM001). */
export interface Batch {
  id: string;
  productId: string;
  number: string;
  orderedQty: number;
  shippedQty: number;
  dueDate: string; // ISO date
  note?: string;
  /** operationId -> completed units */
  completed: Record<string, number>;
  /**
   * Batch-local copy of the manufacturing knowledge. Created on the first route/graph
   * edit inside the batch; other batches of the same product are unaffected.
   */
  routeOverride?: {
    components: ComponentGroup[];
    operations: Operation[];
    operationGroups: OperationGroup[];
  };
}

export type OperationVisualStatus =
  | "done"
  | "running"
  | "ready"
  | "waiting"
  | "next"
  | "blocked";

export interface OperationShortage {
  componentId: string;
  componentName: string;
  required: number;
  available: number;
  leadTimeDays: number;
}

export type ComponentAvailabilityStatus = "full" | "partial" | "none";

export interface OperationRequirement {
  componentId: string;
  componentName: string;
  type: ComponentType;
  required: number;
  available: number;
  ok: boolean;
  availability: ComponentAvailabilityStatus;
}

export interface OperationComputed {
  operationId: string;
  completed: number;
  canPerformNow: number;
  remaining: number;
  status: OperationVisualStatus;
  reason: string;
  shortages: OperationShortage[];
  waitingFor?: { operationId: string; operationName: string; missing: number };
  requirements: OperationRequirement[];
}

export interface OperationGroupComputed {
  groupId: string;
  name: string;
  operationIds: string[];
  completed: number;
  status: OperationVisualStatus;
  reason: string;
}

export type BatchHealth = "ok" | "risk" | "late";

export interface Summary {
  batchSize: number;
  equipped: number;
  assembled: number;
  tested: number;
  shipped: number;
  blockers: { operationId: string; operationName: string; reason: string }[];
  operations: OperationComputed[];
  groups: OperationGroupComputed[];
  fullBatchLeadDays: number;
  totalProductionDays: number;
  delayDays: number;
  health: BatchHealth;
  progressPct: number;
  primaryBlockingReason: string;
}
