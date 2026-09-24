import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SECTIONS, type Permissions, type SectionId } from "./sections";
import { diffForAudit } from "./audit";
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

export type LoadedState = ServerState & {
  canEdit: boolean;
  role: string | null;
  isAdmin: boolean;
  permissions: Permissions;
};

const asJson = (v: unknown) => v as never;

const EDIT_ROLES = ["admin", "production_manager"];

function permsFor(roles: string[], rows: { section: string; can_edit: boolean }[]) {
  const isAdmin = roles.includes("admin");
  const permissions: Permissions = {};
  if (isAdmin) for (const sct of SECTIONS) permissions[sct.id] = "edit";
  else {
    const legacyEdit = roles.some((r) => EDIT_ROLES.includes(r));
    if (rows.length === 0) {
      for (const sct of SECTIONS) if (sct.id !== "settings") permissions[sct.id] = legacyEdit ? "edit" : "view";
    }
    for (const r of rows) permissions[r.section as SectionId] = r.can_edit ? "edit" : "view";
  }
  return { isAdmin, permissions, canEdit: Object.values(permissions).includes("edit") };
}

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
    const permsRes = await supabase.from("section_permissions").select("section, can_edit").eq("user_id", userId);

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
      components: (r.components ?? []) as unknown as Product["components"],
      operations: (r.operations ?? []) as unknown as Product["operations"],
      operationGroups: (r.operation_groups ?? []) as unknown as Product["operationGroups"],
    }));

    const batches: Batch[] = (batchesRes.data ?? []).map((r) => ({
      id: r.id,
      productId: r.product_id,
      number: r.number,
      orderedQty: r.ordered_qty,
      shippedQty: r.shipped_qty,
      dueDate: r.due_date,
      note: r.note ?? undefined,
      completed: (r.completed ?? {}) as unknown as Record<string, number>,
      routeOverride: (r.route_override ?? undefined) as unknown as Batch["routeOverride"],
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
      role: roles.includes("admin") ? "admin" : (roles[0] ?? null),
      ...permsFor(roles, permsRes.data ?? []),
    };
  });

export const saveState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ServerState) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { products, batches, contracts, workcenters, transfers } = data;

    const [rolesRes, permsRes, oldP, oldB, oldC, oldW, profRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("section_permissions").select("section, can_edit").eq("user_id", userId),
      supabase.from("products").select("id, name, components, operations, operation_groups, archived"),
      supabase.from("batches").select("id, number, product_id, completed, shipped_qty, ordered_qty, due_date, route_override"),
      supabase.from("contracts").select("id, number, counterparty"),
      supabase.from("workcenters").select("id, name, workers, hours_per_worker_per_week"),
      supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    ]);
    const { permissions } = permsFor((rolesRes.data ?? []).map((r) => r.role as string), permsRes.data ?? []);
    const can = (sct: SectionId) => permissions[sct] === "edit";

    const fail = (error: { message: string } | null) => {
      if (error) throw new Error(error.message);
    };

    if (can("workcenters")) fail(
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

    if (can("products")) fail(
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
            components: asJson(p.components),
            operations: asJson(p.operations),
            operation_groups: asJson(p.operationGroups),
          })),
        )
      ).error,
    );

    if (can("production")) fail(
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
            completed: asJson(b.completed),
            route_override: asJson(b.routeOverride ?? null),
          })),
        )
      ).error,
    );

    if (can("contracts")) fail(
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
    if (can("contracts") && deliveries.length) fail((await supabase.from("contract_deliveries").upsert(deliveries)).error);

    const links = contracts.flatMap((c) =>
      c.deliveries.flatMap((d) => d.batchIds.map((b) => ({ delivery_id: d.id, batch_id: b }))),
    );

    // Remove rows that no longer exist client-side.
    const prune = async (table: "products" | "batches" | "contracts" | "workcenters", ids: string[]) => {
      const q = supabase.from(table).delete();
      fail((await (ids.length ? q.not("id", "in", `(${ids.map((i) => `"${i}"`).join(",")})`) : q.neq("id", "")))
        .error);
    };

    if (can("contracts")) await prune("contracts", contracts.map((c) => c.id));
    if (can("production")) await prune("batches", batches.map((b) => b.id));
    if (can("products")) await prune("products", products.map((p) => p.id));
    if (can("workcenters")) await prune("workcenters", workcenters.map((w) => w.id));

    const deliveryIds = deliveries.map((d) => d.id);
    if (can("contracts")) {
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
    }

    if (can("workcenters")) {
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

    }

    const entries = diffForAudit(
      { products: oldP.data ?? [], batches: oldB.data ?? [], contracts: oldC.data ?? [], workcenters: oldW.data ?? [] },
      data,
    ).filter((e) => can(e.section as SectionId));
    if (entries.length) {
      await supabase.from("audit_log").insert(
        entries.map((e) => ({ ...e, user_id: userId, user_name: profRes.data?.display_name ?? null })),
      );
    }

    return { ok: true };
  });
