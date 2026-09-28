import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProduction } from "@/lib/production/store";
import type { Batch, Product } from "@/lib/production/types";

export const Route = createFileRoute("/_authenticated/warehouse")({
  head: () => ({
    meta: [
      { title: "Склад — Управление производством" },
      { name: "description", content: "Остатки, резервы под партии, дефицит и заказы компонентов." },
      { property: "og:title", content: "Склад — Управление производством" },
      { property: "og:description", content: "Остатки, резервы под партии, дефицит и заказы компонентов." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WarehousePage,
});

type Item = { id: string; name: string; unit: string; available: number; note: string | null };
type Res = { id: string; batch_id: string; item_name: string; required: number; reserved: number; created_at: string };
type Order = { id: string; item_name: string; quantity: number; expected_date: string | null; received: boolean };
type Tab = "available" | "used" | "deficit" | "ordered";

const btn = "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50";
const btnP = "rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50";
const inp = "rounded-md border border-input bg-background px-2 py-1 text-sm";

function needsFor(product: Product, batch: Batch) {
  const comps = batch.routeOverride?.components ?? product.components;
  const m = new Map<string, number>();
  for (const g of comps) {
    if (g.type === "semi-product") continue;
    for (const p of g.positions) {
      const q = g.type === "fixture" ? (g.fixtureCount ?? p.quantityPerUnit) : p.quantityPerUnit * batch.orderedQty;
      m.set(p.name, (m.get(p.name) ?? 0) + q);
    }
  }
  return [...m.entries()].map(([name, required]) => ({ name, required }));
}

async function log(action: string, entity: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_log").insert({ user_id: data.user.id, user_name: data.user.email?.split("@")[0], section: "warehouse", action, entity });
}

function WarehousePage() {
  const { products, batches, permissions } = useProduction();
  const canEdit = permissions.warehouse === "edit";
  const [tab, setTab] = useState<Tab>("available");
  const [items, setItems] = useState<Item[]>([]);
  const [res, setRes] = useState<Res[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from("stock_items").select("*").order("name"),
      supabase.from("stock_reservations").select("*").order("created_at"),
      supabase.from("stock_orders").select("*").order("created_at"),
    ]);
    setItems((a.data ?? []) as Item[]);
    setRes((b.data ?? []) as Res[]);
    setOrders((c.data ?? []) as Order[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); } catch (e) { toast.error(e instanceof Error ? e.message : "Ошибка"); }
    await load();
    setBusy(false);
  };
  const chk = <T,>(r: { error: { message: string } | null; data?: T }) => { if (r.error) throw new Error(r.error.message); return r.data as T; };

  const batchName = (id: string) => batches.find((b) => b.id === id)?.number ?? id;
  const unitOf = (name: string) => items.find((i) => i.name === name)?.unit ?? "шт";

  // ---- Запуск партии ----
  const launched = new Set(res.map((r) => r.batch_id));
  const candidates = batches.filter((b) => !launched.has(b.id));
  const [launchId, setLaunchId] = useState("");
  const [check, setCheck] = useState<{ batch: Batch; rows: { name: string; required: number; available: number }[] } | null>(null);

  const startCheck = () => {
    const batch = batches.find((b) => b.id === launchId);
    const product = batch && products.find((p) => p.id === batch.productId);
    if (!batch || !product) return;
    const rows = needsFor(product, batch).map((n) => ({ ...n, available: Number(items.find((i) => i.name === n.name)?.available ?? 0) }));
    setCheck({ batch, rows });
  };
  const doLaunch = () => check && run(async () => {
    for (const r of check.rows) {
      const it = items.find((i) => i.name === r.name);
      const reserve = Math.min(r.required, Math.max(0, Number(it?.available ?? 0)));
      if (it && reserve > 0) chk(await supabase.from("stock_items").update({ available: Number(it.available) - reserve }).eq("id", it.id));
      chk(await supabase.from("stock_reservations").insert({ batch_id: check.batch.id, item_name: r.name, required: r.required, reserved: reserve }));
    }
    await log("Запуск партии: компоненты зарезервированы", `Партия ${check.batch.number}`);
    setCheck(null); setLaunchId("");
  }, "Партия запущена, компоненты зарезервированы");

  const release = (batchId: string) => run(async () => {
    for (const r of res.filter((x) => x.batch_id === batchId)) {
      const it = items.find((i) => i.name === r.item_name);
      if (it && Number(r.reserved) > 0) chk(await supabase.from("stock_items").update({ available: Number(it.available) + Number(r.reserved) }).eq("id", it.id));
    }
    chk(await supabase.from("stock_reservations").delete().eq("batch_id", batchId));
    await log("Резерв снят, компоненты возвращены на склад", `Партия ${batchName(batchId)}`);
  }, "Резерв снят");

  // ---- Доступные ----
  const [newItem, setNewItem] = useState({ name: "", unit: "шт", available: "" });
  const addItem = () => run(async () => {
    if (!newItem.name.trim()) throw new Error("Укажите наименование");
    chk(await supabase.from("stock_items").insert({ name: newItem.name.trim(), unit: newItem.unit || "шт", available: Number(newItem.available) || 0 }));
    await log(`Добавлена позиция: ${Number(newItem.available) || 0} ${newItem.unit}`, newItem.name.trim());
    setNewItem({ name: "", unit: "шт", available: "" });
  }, "Позиция добавлена");
  const setQty = (it: Item, v: number) => run(async () => {
    chk(await supabase.from("stock_items").update({ available: v }).eq("id", it.id));
    await log(`Остаток: ${it.available} → ${v} ${it.unit}`, it.name);
  });
  const delItem = (it: Item) => run(async () => {
    chk(await supabase.from("stock_items").delete().eq("id", it.id));
    await log("Позиция удалена", it.name);
  });

  // ---- Дефицит ----
  const deficit = useMemo(() => {
    const m = new Map<string, { short: number; batches: string[] }>();
    for (const r of res) {
      const s = Number(r.required) - Number(r.reserved);
      if (s <= 0) continue;
      const e = m.get(r.item_name) ?? { short: 0, batches: [] };
      e.short += s; e.batches.push(r.batch_id);
      m.set(r.item_name, e);
    }
    return [...m.entries()].map(([name, e]) => {
      const ordered = orders.filter((o) => !o.received && o.item_name === name).reduce((s, o) => s + Number(o.quantity), 0);
      return { name, ...e, ordered, toOrder: Math.max(0, e.short - ordered) };
    });
  }, [res, orders]);
  const [orderForm, setOrderForm] = useState<{ name: string; qty: string; date: string } | null>(null);
  const placeOrder = () => orderForm && run(async () => {
    const q = Number(orderForm.qty);
    if (!(q > 0)) throw new Error("Укажите количество");
    chk(await supabase.from("stock_orders").insert({ item_name: orderForm.name, quantity: q, expected_date: orderForm.date || null }));
    await log(`Оформлен заказ: ${q} ${unitOf(orderForm.name)}${orderForm.date ? `, ожидается ${orderForm.date}` : ""}`, orderForm.name);
    setOrderForm(null);
  }, "Заказ оформлен");

  // ---- Получено ----
  const receive = (o: Order) => run(async () => {
    let left = Number(o.quantity);
    for (const r of res.filter((x) => x.item_name === o.item_name && Number(x.required) > Number(x.reserved))) {
      if (left <= 0) break;
      const add = Math.min(left, Number(r.required) - Number(r.reserved));
      chk(await supabase.from("stock_reservations").update({ reserved: Number(r.reserved) + add }).eq("id", r.id));
      left -= add;
    }
    if (left > 0) {
      const it = items.find((i) => i.name === o.item_name);
      if (it) chk(await supabase.from("stock_items").update({ available: Number(it.available) + left }).eq("id", it.id));
      else chk(await supabase.from("stock_items").insert({ name: o.item_name, available: left }));
    }
    chk(await supabase.from("stock_orders").update({ received: true }).eq("id", o.id));
    await log(`Получено ${o.quantity} ${unitOf(o.item_name)} (в резерв ${Number(o.quantity) - left}, на склад ${left})`, o.item_name);
  }, "Поставка принята");

  const usedByBatch = useMemo(() => {
    const m = new Map<string, Res[]>();
    for (const r of res) m.set(r.batch_id, [...(m.get(r.batch_id) ?? []), r]);
    return [...m.entries()];
  }, [res]);
  const openOrders = orders.filter((o) => !o.received);

  const tabs: { id: Tab; title: string; n: number }[] = [
    { id: "available", title: "Доступные", n: items.length },
    { id: "used", title: "Задействованные", n: usedByBatch.length },
    { id: "deficit", title: "Дефицит", n: deficit.length },
    { id: "ordered", title: "Заказанные", n: openOrders.length },
  ];

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Склад</h1>
        {canEdit && (
          <div className="flex items-center gap-2">
            <select className={inp} value={launchId} onChange={(e) => setLaunchId(e.target.value)}>
              <option value="">Партия для запуска…</option>
              {candidates.map((b) => <option key={b.id} value={b.id}>{b.number} — {products.find((p) => p.id === b.productId)?.name}</option>)}
            </select>
            <button className={btnP} disabled={!launchId || busy} onClick={startCheck}>Запустить партию</button>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === t.id ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}>
            {t.title} <span className="text-muted-foreground">({t.n})</span>
          </button>
        ))}
      </div>

      {tab === "available" && (
        <div className="space-y-3">
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <input className={`${inp} w-72`} placeholder="Наименование (как в составе изделия)" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
              <input className={`${inp} w-24`} placeholder="Кол-во" type="number" value={newItem.available} onChange={(e) => setNewItem({ ...newItem, available: e.target.value })} />
              <input className={`${inp} w-20`} placeholder="Ед." value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
              <button className={btnP} disabled={busy} onClick={addItem}>Добавить</button>
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="py-2">Наименование</th><th>Свободно</th><th>Ед.</th><th></th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-border">
                  <td className="py-2">{it.name}</td>
                  <td>{canEdit ? <input key={`${it.id}-${it.available}`} className={`${inp} w-24`} type="number" defaultValue={it.available} onBlur={(e) => Number(e.target.value) !== Number(it.available) && setQty(it, Number(e.target.value))} /> : it.available}</td>
                  <td>{it.unit}</td>
                  <td className="text-right">{canEdit && <button className={btn} onClick={() => delItem(it)}>Удалить</button>}</td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Склад пуст</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "used" && (
        <div className="space-y-4">
          {usedByBatch.map(([bid, rows]) => (
            <div key={bid} className="rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
                <div className="font-medium">Партия {batchName(bid)}</div>
                {canEdit && <button className={btn} disabled={busy} onClick={() => release(bid)}>Снять резерв</button>}
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground"><tr><th className="px-3 py-1">Компонент</th><th>Нужно</th><th>Зарезервировано</th><th>Не хватает</th></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const s = Number(r.required) - Number(r.reserved);
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-3 py-1.5">{r.item_name}</td><td>{r.required}</td>
                        <td><span className="rounded bg-status-run/15 px-1.5 text-status-run">{r.reserved}</span></td>
                        <td className={s > 0 ? "text-status-block font-medium" : "text-muted-foreground"}>{s > 0 ? s : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          {!usedByBatch.length && <div className="py-6 text-center text-sm text-muted-foreground">Нет запущенных партий с резервом</div>}
        </div>
      )}

      {tab === "deficit" && (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="py-2">Компонент</th><th>Не хватает</th><th>Уже заказано</th><th>Партии</th><th></th></tr></thead>
          <tbody>
            {deficit.map((d) => (
              <tr key={d.name} className="border-t border-border">
                <td className="py-2">{d.name}</td>
                <td className="text-status-block font-medium">{d.short} {unitOf(d.name)}</td>
                <td>{d.ordered || "—"}</td>
                <td className="text-muted-foreground">{[...new Set(d.batches)].map(batchName).join(", ")}</td>
                <td className="text-right">{canEdit && d.toOrder > 0 && <button className={btnP} onClick={() => setOrderForm({ name: d.name, qty: String(d.toOrder), date: "" })}>Заказать</button>}</td>
              </tr>
            ))}
            {!deficit.length && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Дефицита нет</td></tr>}
          </tbody>
        </table>
      )}

      {tab === "ordered" && (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="py-2">Компонент</th><th>Количество</th><th>Ожидается</th><th></th></tr></thead>
          <tbody>
            {openOrders.map((o) => {
              const late = o.expected_date && o.expected_date < new Date().toISOString().slice(0, 10);
              return (
                <tr key={o.id} className="border-t border-border">
                  <td className="py-2">{o.item_name}</td><td>{o.quantity} {unitOf(o.item_name)}</td>
                  <td className={late ? "text-status-block" : ""}>{o.expected_date ? new Date(o.expected_date).toLocaleDateString("ru-RU") : "—"}</td>
                  <td className="text-right">{canEdit && <label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" disabled={busy} onChange={() => receive(o)} /> Получено</label>}</td>
                </tr>
              );
            })}
            {!openOrders.length && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Открытых заказов нет</td></tr>}
          </tbody>
        </table>
      )}

      {check && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 space-y-3 shadow-lg">
            <h2 className="text-lg font-semibold">Запуск партии {check.batch.number}</h2>
            {(() => {
              const short = check.rows.filter((r) => r.available < r.required);
              if (!check.rows.length) return <p className="text-sm text-muted-foreground">В составе изделия нет закупаемых компонентов.</p>;
              if (!short.length) return <p className="text-sm">Все компоненты есть на складе и будут зарезервированы.</p>;
              return (
                <>
                  <p className="text-sm">Не хватает компонентов:</p>
                  <div className="max-h-64 overflow-auto rounded border border-border">
                    <table className="w-full text-sm">
                      <thead className="text-left text-muted-foreground"><tr><th className="px-2 py-1">Компонент</th><th>Нужно</th><th>Есть</th><th>Нехватка</th></tr></thead>
                      <tbody>{short.map((r) => <tr key={r.name} className="border-t border-border"><td className="px-2 py-1">{r.name}</td><td>{r.required}</td><td>{r.available}</td><td className="text-status-block font-medium">{r.required - r.available}</td></tr>)}</tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">Имеющееся будет зарезервировано, недостающее попадёт в «Дефицит».</p>
                </>
              );
            })()}
            <div className="flex justify-end gap-2">
              <button className={btn} onClick={() => setCheck(null)}>Отмена</button>
              <button className={btnP} disabled={busy} onClick={doLaunch}>{check.rows.some((r) => r.available < r.required) ? "Запустить всё равно" : "Запустить"}</button>
            </div>
          </div>
        </div>
      )}

      {orderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 space-y-3 shadow-lg">
            <h2 className="text-lg font-semibold">Заказ: {orderForm.name}</h2>
            <label className="block text-sm">Количество<input className={`${inp} mt-1 w-full`} type="number" value={orderForm.qty} onChange={(e) => setOrderForm({ ...orderForm, qty: e.target.value })} /></label>
            <label className="block text-sm">Ожидаемая дата<input className={`${inp} mt-1 w-full`} type="date" value={orderForm.date} onChange={(e) => setOrderForm({ ...orderForm, date: e.target.value })} /></label>
            <div className="flex justify-end gap-2">
              <button className={btn} onClick={() => setOrderForm(null)}>Отмена</button>
              <button className={btnP} disabled={busy} onClick={placeOrder}>Оформить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
