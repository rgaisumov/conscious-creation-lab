export type ComponentType = "material" | "eri" | "fixture" | "semi-product";

export interface Position {
  id: string;
  name: string;
  quantityPerUnit: number;
  stock: number;
  leadTimeDays: number;
}

export interface ComponentGroup {
  id: string;
  name: string;
  type: ComponentType;
  positions: Position[];
  isShared?: boolean;
  fixtureCount?: number;
  producedByOperationId?: string | null;
}

export interface Operation {
  id: string;
  name: string;
  responsible: string;
  durationHours: number;
  order: number;
  inputComponentIds: string[];
  outputComponentId: string | null;
  completedUnits: number;
  note?: string;
}

export interface Product {
  id: string;
  name: string;
  batchSize: number;
  shippedUnits: number;
  assembledOperationId?: string;
  testedOperationId?: string;
  components: ComponentGroup[];
  operations: Operation[];
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

export interface OperationComputed {
  operationId: string;
  completed: number;
  canPerformNow: number;
  remaining: number;
  status: OperationVisualStatus;
  reason: string;
  shortages: OperationShortage[];
  waitingFor?: { operationId: string; operationName: string; missing: number };
  requirements: {
    componentId: string;
    componentName: string;
    type: ComponentType;
    required: number;
    available: number;
    ok: boolean;
  }[];
}

export interface Summary {
  batchSize: number;
  equipped: number;
  assembled: number;
  tested: number;
  shipped: number;
  blockers: { operationId: string; operationName: string; reason: string }[];
  operations: OperationComputed[];
  fullBatchLeadDays: number;
  totalProductionDays: number;
}
