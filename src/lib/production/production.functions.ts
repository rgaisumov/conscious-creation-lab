import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  Batch,
  Contract,
  Product,
  TransferTime,
  Workcenter,
} from "./types";

export type ServerState = {
  products: Product[];
  batches: Batch[];
  contracts: Contract[];
  workcenters: Workcenter[];
  transfers: TransferTime[];
};

export type LoadedState = ServerState & { canEdit: boolean; role: string | null };

const EDIT_ROLES = ["admin", "production_manager"];

export const loadState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LoadedState> => {
    const { supabase, userId } = context;

    const [
      productsRes,
      batchesRes,
      contractsRes,
      deliveriesRes,
      linksRes,
      workcentersRes,
      transfersRes,
      rolesRes,
    ] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("batches").select("*"),
      supabase.from("contracts").select("*"),
      supabase.from("contract_deliveries").select("*"),
      supabase.from("delivery_batches").select("*"),
      supabase.from("workcenters").select("*"),
      supabase.from("transfer_times").select("*"),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const firstError = [
      productsRes.error,
      batchesRes.error,
      contractsRes.error,
      deliveriesRes.error,
      linksRes.error,
      workcentersRes.error,
      transfersRes.error,
    ].find(Boolean);
    if (firstError) throw new Error(firstError.message);

    const roles = (rolesRes.data ?? []).map((r) => r.role as string);

    const products: Product[] = (productsRes.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      version: r.version,
      note: r.note ?? undefined,
      archived: r.archived,
      assembledOperationId: r.assembled_operation_id ?? undefined,
      testedOperationId: r.tested_operation_id ?? undefined,
      components: (r.components ?? []) as Product["components"],
      operations: (r.operations ?? []) as Product["operations"],
      operationGroups: (r.operation_groups ?? []) as Product["operationGroups"],
    }));

    const batches: Batch[] = (batchesRes.data ?? []).map((r) => ({
      id: r.id,
      productId: r.product_id,
      number: r.number,
      orderedQty: r.ordered_qty,
      shippedQty: r.shipped_qty,
      dueDate: r.due_date,
      note: r.note ?? undefined,
      completed: (r.completed ?? {}) as Record<string, number>,
      routeOverride: (r.route_override ?? undefined) as Batch["routeOverride"],
    }));

    const linksByDelivery = new Map<string, string[]>();
    for (const l of linksRes.data ?? []) {
      const list = linksByDelivery.get(l.delivery_id) ?? [];
      list.push(l.batch_id);
      linksByDelivery.set(l.delivery_id, list);
    }

    const contracts: Contract[] = (contractsRes.data ?? []).map((r) => ({
      id: r.id,
      number: r.number,
      counterparty: r.counterparty,
      productId: r.product_id,
      decimalNumber: r.decimal_number,
      signedDate: r.signed_date,
      note: r.note ?? undefined,
      deliveries: (deliveriesRes.data ?? [])
        .filter((d) => d.contract_id === r.id)
        .map((d) => ({
          id: d.id,
          date: d.date,
          quantity: d.quantity,
          batchIds: linksByDelivery.get(d.id) ?? [],
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }));

    const workcenters: Workcenter[] = (workcentersRes.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      workers: r.workers,
      hoursPerWorkerPerWeek: r.hours_per_worker_per_week,
      note: r.note ?? undefined,
    }));

    const transfers: TransferTime[] = (transfersRes.data ?? []).map((r) => ({
      fromNode: r.from_node,
      toNode: r.to_node,
      hours: Number(r.hours),
    }));

    return {
      products,
      batches,
      contracts,
      workcenters,
      transfers,
      role: roles[0] ?? null,
      canEdit: roles.some((r) => EDIT_ROLES.includes(r)),
    };
  });

export const saveState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ServerState) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { products, batches, contracts, workcenters, transfers } = data;

    const fail = (error: { message: string } | null) => {
      if (error) throw new Error(error.message);
    };

    fail(
      (
        await supabase.from("workcenters").upsert(
          workcenters.map((w) => ({
            id: w.id,
            name: w.name,
            workers: w.workers,
            hours_per_worker_per_week: w.hoursPerWorkerPerWeek,
            note: w.note ?? null,
          })),
        )
      ).error,
    );

    fail(
      (
        await supabase.from("products").upsert(
          products.map((p) => ({
            id: p.id,
            name: p.name,
            version: p.version,
            note: p.note ?? null,
            archived: p.archived ?? false,
            assembled_operation_id: p.assembledOperationId ?? null,
            tested_operation_id: p.testedOperationId ?? null,
            components: p.components,
            operations: p.operations,
            operation_groups: p.operationGroups,
          })),
        )
      ).error,
    );

    fail(
      (
        await supabase.from("batches").upsert(
          batches.map((b) => ({
            id: b.id,
            product_id: b.productId,
            number: b.number,
            ordered_qty: b.orderedQty,
            shipped_qty: b.shippedQty,
            due_date: b.dueDate,
            note: b.note ?? null,
            completed: b.completed,
            route_override: b.routeOverride ?? null,
          })),
        )
      ).error,
    );

    fail(
      (
        await supabase.from("contracts").upsert(
          contracts.map((c) => ({
            id: c.id,
            number: c.number,
            counterparty: c.counterparty,
            product_id: c.productId,
            decimal_number: c.decimalNumber,
            signed_date: c.signedDate,
            note: c.note ?? null,
          })),
        )
      ).error,
    );

    const deliveries = contracts.flatMap((c) =>
      c.deliveries.map((d) => ({
        id: d.id,
        contract_id: c.id,
        date: d.date,
        quantity: d.quantity,
      })),
    );
    if (deliveries.length) fail((await supabase.from("contract_deliveries").upsert(deliveries)).error);

    const links = contracts.flatMap((c) =>
      c.deliveries.flatMap((d) => d.batchIds.map((b) => ({ delivery_id: d.id, batch_id: b }))),
    );

    // Remove rows that no longer exist client-side.
    const prune = async (table: "products" | "batches" | "contracts" | "workcenters", ids: string[]) => {
      const q = supabase.from(table).delete();
      fail((await (ids.length ? q.not("id", "in", `(${ids.map((i) => `"${i}"`).join(",")})`) : q.neq("id", "")))
        .error);
    };

    await prune("contracts", contracts.map((c) => c.id));
    await prune("batches", batches.map((b) => b.id));
    await prune("products", products.map((p) => p.id));
    await prune("workcenters", workcenters.map((w) => w.id));

    const deliveryIds = deliveries.map((d) => d.id);
    fail(
      (
        await (deliveryIds.length
          ? supabase
              .from("contract_deliveries")
              .delete()
              .not("id", "in", `(${deliveryIds.map((i) => `"${i}"`).join(",")})`)
          : supabase.from("contract_deliveries").delete().neq("id", ""))
      ).error,
    );

    fail((await supabase.from("delivery_batches").delete().neq("delivery_id", "")).error);
    if (links.length) fail((await supabase.from("delivery_batches").insert(links)).error);

    fail((await supabase.from("transfer_times").delete().neq("id", "")).error);
    if (transfers.length) {
      fail(
        (
          await supabase.from("transfer_times").insert(
            transfers.map((t) => ({
              id: `tt-${t.fromNode}-${t.toNode}`,
              from_node: t.fromNode,
              to_node: t.toNode,
              hours: t.hours,
            })),
          )
        ).error,
      );
    }

    return { ok: true };
  });
