import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { initialProduct } from "./data";
import { computeSummary } from "./calculator";
import type { Operation, Product, Summary } from "./types";

type Ctx = {
  product: Product;
  summary: Summary;
  setProduct: (p: Product) => void;
  setBatchSize: (n: number) => void;
  setShipped: (n: number) => void;
  updateOperation: (id: string, patch: Partial<Operation>) => void;
};

const ProductionContext = createContext<Ctx | null>(null);

export function ProductionProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<Product>(initialProduct);
  const summary = useMemo(() => computeSummary(product), [product]);

  const setBatchSize = useCallback(
    (n: number) => setProduct((p) => ({ ...p, batchSize: Math.max(1, n) })),
    [],
  );
  const setShipped = useCallback(
    (n: number) =>
      setProduct((p) => ({ ...p, shippedUnits: Math.max(0, Math.min(p.batchSize, n)) })),
    [],
  );
  const updateOperation = useCallback(
    (id: string, patch: Partial<Operation>) =>
      setProduct((p) => ({
        ...p,
        operations: p.operations.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      })),
    [],
  );

  const value: Ctx = { product, summary, setProduct, setBatchSize, setShipped, updateOperation };
  return <ProductionContext.Provider value={value}>{children}</ProductionContext.Provider>;
}

export function useProduction() {
  const ctx = useContext(ProductionContext);
  if (!ctx) throw new Error("useProduction must be used inside ProductionProvider");
  return ctx;
}
