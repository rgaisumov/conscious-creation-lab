import type {
  ComponentGroup,
  ComponentAvailability,
  LimitingFactor,
  OperationResult,
  CalculationSummary,
  Product,
  Position,
} from "./types";

export function computeComponentAvailability(
  component: ComponentGroup,
  batchSize: number,
): ComponentAvailability {
  // Semi-products: availability is computed by their producing operation, not stock
  if (component.type === "semi-product") {
    return {
      componentId: component.id,
      maxUnits: Infinity,
      limitingPosition: null,
    };
  }

  // Shared fixtures do not limit how many units can be produced, only parallelism
  if (component.type === "fixture" && component.isShared) {
    return {
      componentId: component.id,
      maxUnits: Infinity,
      limitingPosition: null,
    };
  }

  // Per-unit fixtures: limited by fixture count
  if (component.type === "fixture" && !component.isShared) {
    const maxUnits = component.fixtureCount ?? 0;
    return {
      componentId: component.id,
      maxUnits,
      limitingPosition: null,
    };
  }

  // Materials / ERI groups: limited by stock vs. quantity per unit
  let limitingPosition: Position | null = null;
  let maxUnits = Infinity;

  for (const position of component.positions) {
    if (position.quantityPerUnit <= 0) continue;
    const available = Math.floor(position.stock / position.quantityPerUnit);
    if (available < maxUnits) {
      maxUnits = available;
      limitingPosition = position;
    }
  }

  if (maxUnits === Infinity) {
    maxUnits = 0;
  }

  return {
    componentId: component.id,
    maxUnits,
    limitingPosition,
  };
}

export function computeProductCalculations(
  product: Product,
  batchSize: number,
): CalculationSummary {
  const availability = new Map<string, ComponentAvailability>();
  for (const component of product.components) {
    availability.set(component.id, computeComponentAvailability(component, batchSize));
  }

  const sortedOperations = [...product.operations].sort((a, b) => a.order - b.order);
  const operationResults: OperationResult[] = [];

  let previousMaxUnits = Infinity;
  let previousOperationName = "Начало";

  for (const operation of sortedOperations) {
    let canCompleteUnits = previousMaxUnits;
    let limitedBy: LimitingFactor = {
      type: "previous-operation",
      id: "start",
      name: previousOperationName,
      availableUnits: previousMaxUnits,
    };

    for (const componentId of operation.inputComponentIds) {
      const avail = availability.get(componentId);
      if (!avail) continue;
      if (avail.maxUnits < canCompleteUnits) {
        canCompleteUnits = avail.maxUnits;
        const component = product.components.find((c) => c.id === componentId);
        limitedBy = {
          type: "component",
          id: componentId,
          name: component?.name ?? componentId,
          availableUnits: avail.maxUnits,
        };
      }
    }

    // Output of previous operation is an implicit input for this operation
    if (previousMaxUnits < canCompleteUnits) {
      canCompleteUnits = previousMaxUnits;
      limitedBy = {
        type: "previous-operation",
        id: previousOperationName === "Начало" ? "start" : operation.id,
        name: previousOperationName,
        availableUnits: previousMaxUnits,
      };
    }

    operationResults.push({
      operationId: operation.id,
      canCompleteUnits,
      limitedBy,
    });

    previousMaxUnits = canCompleteUnits;
    previousOperationName = operation.name;
  }

  const canStartNow =
    operationResults.length > 0 ? operationResults[0].canCompleteUnits : 0;
  const globalBottleneck =
    operationResults.length > 0
      ? operationResults[operationResults.length - 1].limitedBy
      : { type: "component" as const, id: "none", name: "—", availableUnits: 0 };

  // Full batch availability: max lead time among components that are short for the full batch
  let fullBatchAvailabilityDays = 0;
  for (const component of product.components) {
    if (component.type === "semi-product" || component.type === "fixture") continue;
    for (const position of component.positions) {
      const required = position.quantityPerUnit * batchSize;
      if (required > position.stock && position.leadTimeDays > fullBatchAvailabilityDays) {
        fullBatchAvailabilityDays = position.leadTimeDays;
      }
    }
  }

  // Estimated completion days: full batch availability + sum of operation durations converted to days
  const totalProductionDays = sortedOperations.reduce(
    (sum, op) => sum + op.durationHours / 24,
    0,
  );
  const estimatedCompletionDays = fullBatchAvailabilityDays + totalProductionDays;

  return {
    batchSize,
    canStartNow,
    globalBottleneck,
    operationResults,
    fullBatchAvailabilityDays,
    estimatedCompletionDays,
  };
}

export function getShortageForBatch(
  component: ComponentGroup,
  batchSize: number,
): { position: Position; required: number; short: number }[] {
  if (component.type === "semi-product" || component.type === "fixture") return [];
  return component.positions
    .map((position) => ({
      position,
      required: position.quantityPerUnit * batchSize,
      short: Math.max(0, position.quantityPerUnit * batchSize - position.stock),
    }))
    .filter((item) => item.short > 0);
}
