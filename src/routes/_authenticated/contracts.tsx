import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, X, Eye, Search } from "lucide-react";
import { useProduction } from "@/lib/production/store";
import type { Batch, Contract, ContractDelivery } from "@/lib/production/types";

export const Route = createFileRoute("/_authenticated/contracts")({
  head: () => ({
    meta: [
      { title: "Договоры — сроки поставки и привязка партий" },
      {
        name: "description",
        content:
          "Реестр договоров: контрагент, децимальный номер изделия, даты поставки с количеством и привязанные производственные партии с контролем просрочки.",
      },
      { property: "og:title", content: "Договоры — сроки поставки и привязка партий" },
      {
        property: "og:description",
        content: "Контроль сроков по договорам и просрочек привязанных партий.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContractsPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function batchDone(b: Batch) {
  return b.shippedQty >= b.orderedQty;
}

function isOverdue(b: Batch, d: ContractDelivery) {
  return !batchDone(b) && d.date < today();
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

const inputCls =
  "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

function ContractsPage() {
  const {
    contracts,
    products,
    batches,
    addContract,
    updateContract,
    removeContract,
    addDelivery,
    updateDelivery,
    removeDelivery,
    attachBatch,
    detachBatch,
  } = useProduction();

  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [filterProductId, setFilterProductId] = useState("all");
  const [onlyLate, setOnlyLate] = useState(false);

  const deliveryState = (c: Contract, d: ContractDelivery) => {
    const linked = d.batchIds
      .map((id) => batches.find((x) => x.id === id))
      .filter(Boolean) as Batch[];
    const late = linked.some((b) => isOverdue(b, d));
    const shipped = linked.reduce((s, b) => s + b.shippedQty, 0);
    return { linked, late, shipped };
  };

  const q = query.trim().toLowerCase();
  const visibleContracts = contracts.filter((c) => {
    if (filterProductId !== "all" && c.productId !== filterProductId) return false;
    if (onlyLate && !c.deliveries.some((d) => deliveryState(c, d).late)) return false;
    if (!q) return true;
    const product = products.find((p) => p.id === c.productId);
    return (
      c.number.toLowerCase().includes(q) ||
      c.counterparty.toLowerCase().includes(q) ||
      c.decimalNumber.toLowerCase().includes(q) ||
      (product?.name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Договоры</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Обязательства перед заказчиком: сроки, количества и привязанные партии.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {editing ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editing ? "Режим просмотра" : "Редактировать"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => addContract(products[0]?.id ?? "")}
              disabled={products.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Новый договор
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: договор, контрагент, децимальный №…"
            className="w-72 rounded-md border border-border bg-background px-2 py-1.5 pl-7 text-xs text-foreground"
          />
        </div>
        <select
          value={filterProductId}
          onChange={(e) => setFilterProductId(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          aria-label="Фильтр по изделию"
        >
          <option value="all">Все изделия</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={onlyLate} onChange={(e) => setOnlyLate(e.target.checked)} />
          только с просрочкой
        </label>
      </div>

      {visibleContracts.length === 0 && (
        <p className="p-6 text-sm text-muted-foreground">Договоры не найдены.</p>
      )}

      {!editing && visibleContracts.length > 0 && (
        <div className="p-6">
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Договор</th>
                  <th className="px-3 py-2 font-medium">Контрагент</th>
                  <th className="px-3 py-2 font-medium">Изделие</th>
                  <th className="px-3 py-2 font-medium">Децимальный №</th>
                  <th className="px-3 py-2 font-medium">Заключен</th>
                  <th className="px-3 py-2 font-medium">Сроки поставки</th>
                  <th className="px-3 py-2 text-right font-medium">Всего</th>
                </tr>
              </thead>
              <tbody>
                {visibleContracts.map((c) => {
                  const product = products.find((p) => p.id === c.productId);
                  const total = c.deliveries.reduce((s, d) => s + d.quantity, 0);
                  const hasLate = c.deliveries.some((d) => deliveryState(c, d).late);
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-border/60 align-top ${
                        hasLate ? "bg-destructive/5" : ""
                      }`}
                    >
                      <td className="px-3 py-2 font-medium">{c.number || "—"}</td>
                      <td className="px-3 py-2">{c.counterparty || "—"}</td>
                      <td className="px-3 py-2">{product?.name ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.decimalNumber || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(c.signedDate)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          {c.deliveries.length === 0 && (
                            <span className="text-muted-foreground">сроки не заданы</span>
                          )}
                          {c.deliveries.map((d) => {
                            const { linked, late } = deliveryState(c, d);
                            return (
                              <div key={d.id} className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                                    late
                                      ? "bg-destructive/15 text-destructive"
                                      : "bg-muted text-foreground"
                                  }`}
                                >
                                  {d.quantity} шт до {fmtDate(d.date)}
                                </span>
                                {linked.length === 0 ? (
                                  <span className="text-muted-foreground">— партии не привязаны</span>
                                ) : (
                                  linked.map((b) => {
                                    const bLate = isOverdue(b, d);
                                    return (
                                      <Link
                                        key={b.id}
                                        to="/batches/$batchId"
                                        params={{ batchId: b.id }}
                                        className={`rounded border px-1.5 py-0.5 hover:underline ${
                                          bLate
                                            ? "border-destructive text-destructive"
                                            : batchDone(b)
                                              ? "border-border text-muted-foreground"
                                              : "border-border text-foreground"
                                        }`}
                                        title={
                                          bLate
                                            ? "Просрочка по договору"
                                            : batchDone(b)
                                              ? "Закрыта"
                                              : "В работе"
                                        }
                                      >
                                        {b.number} · {b.shippedQty}/{b.orderedQty}
                                      </Link>
                                    );
                                  })
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{total} шт</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <div className="space-y-4 p-6">
          {visibleContracts.map((c) => {
          const product = products.find((p) => p.id === c.productId);
          const productBatches = batches.filter((b) => b.productId === c.productId);
          const hasLate = c.deliveries.some((d) =>
            d.batchIds.some((id) => {
              const b = batches.find((x) => x.id === id);
              return b ? isOverdue(b, d) : false;
            }),
          );

          return (
            <section
              key={c.id}
              className={`rounded-lg border bg-card p-4 ${
                hasLate ? "border-destructive/60" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Номер договора
                    </span>
                    <input
                      className={inputCls}
                      value={c.number}
                      onChange={(e) => updateContract(c.id, { number: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Контрагент
                    </span>
                    <input
                      className={inputCls}
                      value={c.counterparty}
                      onChange={(e) => updateContract(c.id, { counterparty: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Изделие
                    </span>
                    <select
                      className={inputCls}
                      value={c.productId}
                      onChange={(e) => updateContract(c.id, { productId: e.target.value })}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Децимальный номер
                    </span>
                    <input
                      className={inputCls}
                      placeholder="АБВГ.000000.000"
                      value={c.decimalNumber}
                      onChange={(e) => updateContract(c.id, { decimalNumber: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Дата заключения
                    </span>
                    <input
                      type="date"
                      className={inputCls}
                      value={c.signedDate}
                      onChange={(e) => updateContract(c.id, { signedDate: e.target.value })}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeContract(c.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                  aria-label="Удалить договор"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 font-medium">Дата поставки</th>
                      <th className="py-2 pr-3 font-medium">Кол-во, шт</th>
                      <th className="py-2 pr-3 font-medium">Привязанные партии</th>
                      <th className="py-2 pr-3 font-medium">Добавить партию</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {c.deliveries.map((d) => (
                      <tr key={d.id} className="border-b border-border/60 align-top">
                        <td className="py-2 pr-3">
                          <input
                            type="date"
                            className={inputCls}
                            value={d.date}
                            onChange={(e) => updateDelivery(c.id, d.id, { date: e.target.value })}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min={1}
                            className={`${inputCls} w-24`}
                            value={d.quantity}
                            onChange={(e) =>
                              updateDelivery(c.id, d.id, {
                                quantity: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1.5">
                            {d.batchIds.length === 0 && (
                              <span className="text-muted-foreground">— не привязано</span>
                            )}
                            {d.batchIds.map((id) => {
                              const b = batches.find((x) => x.id === id);
                              if (!b)
                                return (
                                  <span key={id} className="text-muted-foreground">
                                    партия удалена
                                  </span>
                                );
                              const late = isOverdue(b, d);
                              return (
                                <span
                                  key={id}
                                  className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${
                                    late
                                      ? "border-destructive bg-destructive/15 text-destructive"
                                      : "border-border text-foreground"
                                  }`}
                                  title={late ? "Просрочка по договору" : undefined}
                                >
                                  <Link
                                    to="/batches/$batchId"
                                    params={{ batchId: b.id }}
                                    className="hover:underline"
                                  >
                                    {b.number}
                                  </Link>
                                  <span className="text-[10px] opacity-80">
                                    {b.shippedQty}/{b.orderedQty} шт
                                    {late ? " · просрочка" : batchDone(b) ? " · закрыта" : ""}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => detachBatch(c.id, d.id, b.id)}
                                    aria-label="Отвязать партию"
                                    className="opacity-70 hover:opacity-100"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <select
                            className={inputCls}
                            value=""
                            onChange={(e) => {
                              if (e.target.value) attachBatch(c.id, d.id, e.target.value);
                            }}
                          >
                            <option value="">Выбрать партию…</option>
                            {productBatches
                              .filter((b) => !d.batchIds.includes(b.id))
                              .map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.number} · {b.orderedQty} шт · до {b.dueDate}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeDelivery(c.id, d.id)}
                            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                            aria-label="Удалить срок поставки"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => addDelivery(c.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Добавить срок поставки
                </button>
                <span className="text-[11px] text-muted-foreground">
                  {product ? `${product.name} · ` : ""}
                  всего по договору: {c.deliveries.reduce((s, d) => s + d.quantity, 0)} шт
                </span>
              </div>
            </section>
          );
        })}
        </div>
      )}
    </div>
  );
}
