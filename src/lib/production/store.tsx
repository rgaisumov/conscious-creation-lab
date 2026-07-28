import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { initialProduct } from "./data";
import { computeSummary } from "./calculator";
import type { Operation, Position, Product, Summary } from "./types";

type Ctx = {
  product: Product;
  summary: Summary;
  setProduct: (p: Product) => void;
  setBatchSize: (n: number) => void;
  setShipped: (n: number) => void;
  updateOperation: (id: string, patch: Partial<Operation>) => void;
  updatePosition: (componentId: string, positionId: string, patch: Partial<Position>) => void;
  updateFixtureCount: (componentId: string, n: number) => void;
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
  const updatePosition = useCallback(
    (componentId: string, positionId: string, patch: Partial<Position>) =>
      setProduct((p) => ({
        ...p,
        components: p.components.map((c) =>
          c.id !== componentId
            ? c
            : { ...c, positions: c.positions.map((pos) => (pos.id === positionId ? { ...pos, ...patch } : pos)) },
        ),
      })),
    [],
  );
  const updateFixtureCount = useCallback(
    (componentId: string, n: number) =>
      setProduct((p) => ({
        ...p,
        components: p.components.map((c) =>
          c.id === componentId ? { ...c, fixtureCount: Math.max(0, n) } : c,
        ),
      })),
    [],
  );

  const value: Ctx = {
    product,
    summary,
    setProduct,
    setBatchSize,
    setShipped,
    updateOperation,
    updatePosition,
    updateFixtureCount,
  };
  return <ProductionContext.Provider value={value}>{children}</ProductionContext.Provider>;
}

export function useProduction() {
  const ctx = useContext(ProductionContext);
  if (!ctx) throw new Error("useProduction must be used inside ProductionProvider");
  return ctx;
}
