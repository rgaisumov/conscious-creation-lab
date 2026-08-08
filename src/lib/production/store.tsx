import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadState, saveState } from "./production.functions";
import { supabase } from "@/integrations/supabase/client";

import { computeSummary } from "./calculator";
import { cloneRoute, type RouteDraft } from "./route-ops";
import type {
  Batch,
  Contract,
  ContractDelivery,
  Position,
  Product,
  Summary,
  TransferTime,
  Workcenter,
} from "./types";

export type RouteTarget = { kind: "product"; productId: string } | { kind: "batch"; batchId: string };

export function routeOfProduct(p: Product): RouteDraft {
  return { components: p.components, operations: p.operations, operationGroups: p.operationGroups };
}

/** Product template with the batch-local route override applied (if any). */
export function effectiveProductFor(product: Product, batch: Batch): Product {
  if (!batch.routeOverride) return product;
  return { ...product, ...batch.routeOverride };
}

export type Theme = "light" | "dark";

type Ctx = {
  products: Product[];
  batches: Batch[];
  contracts: Contract[];
  workcenters: Workcenter[];
  transfers: TransferTime[];
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  getProduct: (id: string) => Product | undefined;
  getBatch: (id: string) => Batch | undefined;
  summaryOf: (batch: Batch) => Summary;
  /** Product knowledge for a batch, with batch-local route override applied. */
  effectiveProduct: (batch: Batch) => Product;
  getRoute: (target: RouteTarget) => RouteDraft | undefined;
  mutateRoute: (target: RouteTarget, fn: (r: RouteDraft) => RouteDraft) => void;
  resetBatchRoute: (batchId: string) => void;
  setCompleted: (batchId: string, operationId: string, n: number) => void;
  setShipped: (batchId: string, n: number) => void;
  setOrderedQty: (batchId: string, n: number) => void;
  updatePosition: (productId: string, componentId: string, positionId: string, patch: Partial<Position>) => void;
  updateFixtureCount: (productId: string, componentId: string, n: number) => void;
  addBatch: (productId: string) => string;
  addProduct: (name?: string) => string;

  addContract: (productId: string) => string;
  updateContract: (contractId: string, patch: Partial<Omit<Contract, "id" | "deliveries">>) => void;
  removeContract: (contractId: string) => void;
  addDelivery: (contractId: string) => void;
  updateDelivery: (contractId: string, deliveryId: string, patch: Partial<Omit<ContractDelivery, "id">>) => void;
  removeDelivery: (contractId: string, deliveryId: string) => void;
  attachBatch: (contractId: string, deliveryId: string, batchId: string) => void;
  detachBatch: (contractId: string, deliveryId: string, batchId: string) => void;

  addWorkcenter: () => string;
  updateWorkcenter: (id: string, patch: Partial<Omit<Workcenter, "id">>) => void;
  removeWorkcenter: (id: string) => void;
  setTransfer: (fromNode: string, toNode: string, hours: number) => void;

  importState: (s: { products: Product[]; batches: Batch[]; contracts?: Contract[] }) => void;
  exportState: () => { products: Product[]; batches: Batch[]; contracts: Contract[] };

  /** Данные ещё загружаются с сервера. */
  loading: boolean;
  /** Есть ли у текущего пользователя право изменять данные. */
  canEdit: boolean;
  /** Роль текущего пользователя. */
  role: string | null;
  /** Последняя ошибка сохранения на сервер. */
  saveError: string | null;
  saving: boolean;
};

const ProductionContext = createContext<Ctx | null>(null);

export function ProductionProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [workcenters, setWorkcenters] = useState<Workcenter[]>([]);
  const [transfers, setTransfers] = useState<TransferTime[]>([]);
  const [theme, setThemeState] = useState<Theme>("dark");
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  // Первичная загрузка состояния с сервера
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setLoading(false);
        return;
      }
      try {
        const state = await loadState();
        if (cancelled) return;
        setProducts(state.products);
        setBatches(state.batches);
        setContracts(state.contracts);
        setWorkcenters(state.workcenters);
        setTransfers(state.transfers);
        setCanEdit(state.canEdit);
        setRole(state.role);
        loadedRef.current = true;
      } catch (e) {
        if (!cancelled) setSaveError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Автосохранение изменений на сервер
  const firstSaveSkip = useRef(true);
  useEffect(() => {
    if (!loadedRef.current || !canEdit) return;
    if (firstSaveSkip.current) {
      firstSaveSkip.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setSaving(true);
      saveState({ data: { products, batches, contracts, workcenters, transfers } })
        .then(() => setSaveError(null))
        .catch((e: unknown) => setSaveError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false));
    }, 700);
    return () => clearTimeout(timer);
  }, [products, batches, contracts, workcenters, transfers, canEdit]);

  useEffect(() => {
    const stored = window.localStorage.getItem("pm-theme");
    if (stored === "light" || stored === "dark") setThemeState(stored);
  }, []);


  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("pm-theme", theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);

  const getProduct = useCallback((id: string) => products.find((p) => p.id === id), [products]);
  const getBatch = useCallback((id: string) => batches.find((b) => b.id === id), [batches]);

  const effectiveProduct = useCallback(
    (batch: Batch) => {
      const product = products.find((p) => p.id === batch.productId);
      if (!product) throw new Error(`Product ${batch.productId} not found`);
      return effectiveProductFor(product, batch);
    },
    [products],
  );

  const summaryOf = useCallback(
    (batch: Batch) => computeSummary(effectiveProduct(batch), batch),
    [effectiveProduct],
  );

  const getRoute = useCallback(
    (target: RouteTarget): RouteDraft | undefined => {
      if (target.kind === "product") {
        const p = products.find((x) => x.id === target.productId);
        return p ? routeOfProduct(p) : undefined;
      }
      const b = batches.find((x) => x.id === target.batchId);
      if (!b) return undefined;
      const p = products.find((x) => x.id === b.productId);
      if (!p) return undefined;
      return b.routeOverride ?? routeOfProduct(p);
    },
    [products, batches],
  );

  const mutateRoute = useCallback(
    (target: RouteTarget, fn: (r: RouteDraft) => RouteDraft) => {
      if (target.kind === "product") {
        setProducts((ps) =>
          ps.map((p) => (p.id !== target.productId ? p : { ...p, ...fn(routeOfProduct(p)) })),
        );
        return;
      }
      setBatches((bs) =>
        bs.map((b) => {
          if (b.id !== target.batchId) return b;
          const base =
            b.routeOverride ??
            cloneRoute(routeOfProduct(products.find((p) => p.id === b.productId)!));
          return { ...b, routeOverride: fn(base) };
        }),
      );
    },
    [products],
  );

  const resetBatchRoute = useCallback((batchId: string) => {
    setBatches((bs) => bs.map((b) => (b.id !== batchId ? b : { ...b, routeOverride: undefined })));
  }, []);


  const setCompleted = useCallback((batchId: string, operationId: string, n: number) => {
    setBatches((bs) =>
      bs.map((b) =>
        b.id !== batchId
          ? b
          : { ...b, completed: { ...b.completed, [operationId]: Math.max(0, Math.min(b.orderedQty, n)) } },
      ),
    );
  }, []);

  const setShipped = useCallback((batchId: string, n: number) => {
    setBatches((bs) =>
      bs.map((b) => (b.id !== batchId ? b : { ...b, shippedQty: Math.max(0, Math.min(b.orderedQty, n)) })),
    );
  }, []);

  const setOrderedQty = useCallback((batchId: string, n: number) => {
    setBatches((bs) => bs.map((b) => (b.id !== batchId ? b : { ...b, orderedQty: Math.max(1, n) })));
  }, []);

  const updatePosition = useCallback(
    (productId: string, componentId: string, positionId: string, patch: Partial<Position>) => {
      setProducts((ps) =>
        ps.map((p) =>
          p.id !== productId
            ? p
            : {
                ...p,
                components: p.components.map((c) =>
                  c.id !== componentId
                    ? c
                    : {
                        ...c,
                        positions: c.positions.map((pos) =>
                          pos.id === positionId ? { ...pos, ...patch } : pos,
                        ),
                      },
                ),
              },
        ),
      );
    },
    [],
  );

  const updateFixtureCount = useCallback((productId: string, componentId: string, n: number) => {
    setProducts((ps) =>
      ps.map((p) =>
        p.id !== productId
          ? p
          : {
              ...p,
              components: p.components.map((c) =>
                c.id === componentId ? { ...c, fixtureCount: Math.max(0, n) } : c,
              ),
            },
      ),
    );
  }, []);

  const addBatch = useCallback((productId: string) => {
    const id = `b-${Math.random().toString(36).slice(2, 8)}`;
    setBatches((bs) => {
      const count = bs.filter((b) => b.productId === productId).length + 1;
      const due = new Date();
      due.setDate(due.getDate() + 45);
      return [
        ...bs,
        {
          id,
          productId,
          number: `Н-${new Date().getFullYear()}/${String(count).padStart(3, "0")}`,
          orderedQty: 50,
          shippedQty: 0,
          dueDate: due.toISOString().slice(0, 10),
          completed: {},
        },
      ];
    });
    return id;
  }, []);

  const addProduct = useCallback((name?: string) => {
    const id = `p-${Math.random().toString(36).slice(2, 8)}`;
    const semiId = `${id}-semi-1`;
    const matId = `${id}-mat-1`;
    const finalId = `${id}-out`;
    setProducts((ps) => [
      ...ps,
      {
        id,
        name: name?.trim() || `Изделие ${ps.length + 1}`,
        version: "v1.0",
        note: "Новое изделие — заполните тех.маршрут и компоненты",
        assembledOperationId: `${id}-op-2`,
        testedOperationId: `${id}-op-2`,
        operationGroups: [],
        components: [
          {
            id: matId,
            name: "Материал (заготовка)",
            type: "material",
            positions: [
              { id: `${matId}-pos-1`, name: "Позиция 1", quantityPerUnit: 1, stock: 0, leadTimeDays: 14 },
            ],
          },
          {
            id: semiId,
            name: "Полуфабрикат после операции 1",
            type: "semi-product",
            positions: [],
            producedByOperationId: `${id}-op-1`,
          },
          { id: finalId, name: "Готовое изделие", type: "material", positions: [] },
        ],
        operations: [
          {
            id: `${id}-op-1`,
            name: "Операция 1",
            responsible: "—",
            durationHours: 8,
            order: 1,
            inputComponentIds: [matId],
            outputComponentId: semiId,
          },
          {
            id: `${id}-op-2`,
            name: "Операция 2",
            responsible: "—",
            durationHours: 8,
            order: 2,
            inputComponentIds: [semiId],
            outputComponentId: null,
          },
        ],
      },
    ]);
    return id;
  }, []);



  const addContract = useCallback((productId: string) => {
    const id = `c-${Math.random().toString(36).slice(2, 8)}`;
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date();
    due.setMonth(due.getMonth() + 3);
    setContracts((cs) => [
      ...cs,
      {
        id,
        number: `№${cs.length + 1}/${new Date().getFullYear()}`,
        counterparty: "Новый контрагент",
        productId,
        decimalNumber: "",
        signedDate: today,
        deliveries: [
          { id: `${id}-d1`, date: due.toISOString().slice(0, 10), quantity: 50, batchIds: [] },
        ],
      },
    ]);
    return id;
  }, []);

  const updateContract = useCallback(
    (contractId: string, patch: Partial<Omit<Contract, "id" | "deliveries">>) => {
      setContracts((cs) => cs.map((c) => (c.id === contractId ? { ...c, ...patch } : c)));
    },
    [],
  );

  const removeContract = useCallback((contractId: string) => {
    setContracts((cs) => cs.filter((c) => c.id !== contractId));
  }, []);

  const addDelivery = useCallback((contractId: string) => {
    setContracts((cs) =>
      cs.map((c) => {
        if (c.id !== contractId) return c;
        const due = new Date();
        due.setMonth(due.getMonth() + 3);
        return {
          ...c,
          deliveries: [
            ...c.deliveries,
            {
              id: `${contractId}-d-${Math.random().toString(36).slice(2, 6)}`,
              date: due.toISOString().slice(0, 10),
              quantity: 10,
              batchIds: [],
            },
          ],
        };
      }),
    );
  }, []);

  const updateDelivery = useCallback(
    (contractId: string, deliveryId: string, patch: Partial<Omit<ContractDelivery, "id">>) => {
      setContracts((cs) =>
        cs.map((c) =>
          c.id !== contractId
            ? c
            : {
                ...c,
                deliveries: c.deliveries.map((d) => (d.id === deliveryId ? { ...d, ...patch } : d)),
              },
        ),
      );
    },
    [],
  );

  const removeDelivery = useCallback((contractId: string, deliveryId: string) => {
    setContracts((cs) =>
      cs.map((c) =>
        c.id !== contractId ? c : { ...c, deliveries: c.deliveries.filter((d) => d.id !== deliveryId) },
      ),
    );
  }, []);

  const attachBatch = useCallback((contractId: string, deliveryId: string, batchId: string) => {
    setContracts((cs) =>
      cs.map((c) =>
        c.id !== contractId
          ? c
          : {
              ...c,
              deliveries: c.deliveries.map((d) =>
                d.id !== deliveryId || d.batchIds.includes(batchId)
                  ? d
                  : { ...d, batchIds: [...d.batchIds, batchId] },
              ),
            },
      ),
    );
  }, []);

  const detachBatch = useCallback((contractId: string, deliveryId: string, batchId: string) => {
    setContracts((cs) =>
      cs.map((c) =>
        c.id !== contractId
          ? c
          : {
              ...c,
              deliveries: c.deliveries.map((d) =>
                d.id !== deliveryId ? d : { ...d, batchIds: d.batchIds.filter((b) => b !== batchId) },
              ),
            },
      ),
    );
  }, []);

  const addWorkcenter = useCallback(() => {
    const id = `wc-${Math.random().toString(36).slice(2, 8)}`;
    setWorkcenters((ws) => [
      ...ws,
      { id, name: `Новый участок ${ws.length + 1}`, workers: 1, hoursPerWorkerPerWeek: 40 },
    ]);
    return id;
  }, []);

  const updateWorkcenter = useCallback((id: string, patch: Partial<Omit<Workcenter, "id">>) => {
    setWorkcenters((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }, []);

  const removeWorkcenter = useCallback((id: string) => {
    setWorkcenters((ws) => ws.filter((w) => w.id !== id));
    setProducts((ps) =>
      ps.map((p) => ({
        ...p,
        operations: p.operations.map((o) => (o.workcenterId === id ? { ...o, workcenterId: null } : o)),
      })),
    );
  }, []);

  const setTransfer = useCallback((fromNode: string, toNode: string, hours: number) => {
    const h = Math.max(0, hours);
    setTransfers((ts) => {
      const i = ts.findIndex((t) => t.fromNode === fromNode && t.toNode === toNode);
      if (i < 0) return [...ts, { fromNode, toNode, hours: h }];
      const copy = [...ts];
      copy[i] = { fromNode, toNode, hours: h };
      return copy;
    });
  }, []);

  const importState = useCallback(
    (s: { products: Product[]; batches: Batch[]; contracts?: Contract[] }) => {
      if (Array.isArray(s.products)) setProducts(s.products);
      if (Array.isArray(s.batches)) setBatches(s.batches);
      if (Array.isArray(s.contracts)) setContracts(s.contracts);
    },
    [],
  );

  const exportState = useCallback(
    () => ({ products, batches, contracts }),
    [products, batches, contracts],
  );

  const value = useMemo<Ctx>(
    () => ({
      products,
      batches,
      contracts,
      workcenters,
      transfers,
      theme,
      setTheme,
      toggleTheme,
      getProduct,
      getBatch,
      summaryOf,
      effectiveProduct,
      getRoute,
      mutateRoute,
      resetBatchRoute,
      setCompleted,
      setShipped,
      setOrderedQty,
      updatePosition,
      updateFixtureCount,
      addBatch,
      addProduct,
      addContract,
      updateContract,
      removeContract,
      addDelivery,
      updateDelivery,
      removeDelivery,
      attachBatch,
      detachBatch,
      addWorkcenter,
      updateWorkcenter,
      removeWorkcenter,
      setTransfer,
      importState,
      exportState,
    }),
    [
      products,
      batches,
      contracts,
      workcenters,
      transfers,
      theme,
      setTheme,
      toggleTheme,
      getProduct,
      getBatch,
      summaryOf,
      effectiveProduct,
      getRoute,
      mutateRoute,
      resetBatchRoute,
      setCompleted,
      setShipped,
      setOrderedQty,
      updatePosition,
      updateFixtureCount,
      addBatch,
      addProduct,
      addContract,
      updateContract,
      removeContract,
      addDelivery,
      updateDelivery,
      removeDelivery,
      attachBatch,
      detachBatch,
      addWorkcenter,
      updateWorkcenter,
      removeWorkcenter,
      setTransfer,
      importState,
      exportState,
    ],
  );

  return <ProductionContext.Provider value={value}>{children}</ProductionContext.Provider>;
}

export function useProduction() {
  const ctx = useContext(ProductionContext);
  if (!ctx) throw new Error("useProduction must be used inside ProductionProvider");
  return ctx;
}
