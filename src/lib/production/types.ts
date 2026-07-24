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
  // Fixture-specific: shared means one for the whole batch; otherwise one per unit.
  isShared?: boolean;
  fixtureCount?: number;
  // For semi-products: which operation produces this component
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
}

export interface Product {
  id: string;
  name: string;
  components: ComponentGroup[];
  operations: Operation[];
}

export interface LimitingFactor {
  type: "component" | "previous-operation";
  id: string;
  name: string;
  availableUnits: number;
}

export interface OperationResult {
  operationId: string;
  canCompleteUnits: number;
  limitedBy: LimitingFactor;
}

export interface CalculationSummary {
  batchSize: number;
  canStartNow: number;
  globalBottleneck: LimitingFactor;
  operationResults: OperationResult[];
  fullBatchAvailabilityDays: number;
  estimatedCompletionDays: number;
}

export interface ComponentAvailability {
  componentId: string;
  maxUnits: number;
  limitingPosition: Position | null;
}
