import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { computeSummary } from "@/lib/production/calculator";
import { useProduction } from "@/lib/production/store";
import type { Batch, Product, Summary } from "@/lib/production/types";

export type Selection =
  | { kind: "operation"; id: string }
  | { kind: "component"; id: string }
  | null;

type Ctx = {
  product: Product;
  batch: Batch;
  summary: Summary;
  selection: Selection;
  select: (s: Selection) => void;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function BatchWorkspaceProvider({
  product,
  batch,
  children,
}: {
  product: Product;
  batch: Batch;
  children: ReactNode;
}) {
  const [selection, select] = useState<Selection>(null);
  const summary = useMemo(() => computeSummary(product, batch), [product, batch]);
  const value = useMemo<Ctx>(
    () => ({ product, batch, summary, selection, select }),
    [product, batch, summary, selection],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside BatchWorkspaceProvider");
  return ctx;
}

/** Convenience: batch + product + live summary by id, outside the workspace layout. */
export function useBatchSummary(batchId: string) {
  const { getBatch, getProduct, summaryOf } = useProduction();
  const batch = getBatch(batchId);
  const product = batch ? getProduct(batch.productId) : undefined;
  const summary = batch ? summaryOf(batch) : undefined;
  return { batch, product, summary };
}
