import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Info, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProduction } from "@/lib/production/store";
import * as R from "@/lib/production/route-ops";
import { COMPOSITION_TYPES, type ComponentGroup, type ComponentType, type Position } from "@/lib/production/types";
import { TYPE_LABEL } from "@/components/route/RouteEditor";

export const Route = createFileRoute("/_authenticated/products/$productId/composition")({
  head: () => ({
    meta: [
      { title: "Состав изделия — позиции и импорт из Excel" },
      { name: "description", content: "Состав изделия: материалы, ЭРИ, оснастка, количество на изделие, импорт из Excel." },
      { property: "og:title", content: "Состав изделия" },
      { property: "og:description", content: "Позиции изделия и загрузка из Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompositionPage,
});

const uid = () => Math.random().toString(36).slice(2, 10);
const inp = "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground";

const TYPE_BY_TEXT: Record<string, ComponentType> = {
  материал: "material", материалы: "material", эри: "eri", оснастка: "fixture",
  деталь: "detail", детали: "detail", "сборочная единица": "assembly", "сборочные единицы": "assembly", се: "assembly",
  "стандартное изделие": "standard", "стандартные изделия": "standard", упаковка: "packaging",
};

function CompositionPage() {
  const { productId } = Route.useParams();
  const target = { kind: "product", productId } as const;
  const { products, getRoute, mutateRoute } = useProduction();
  const route = getRoute(target);
  if (!route) return null;
  const groups = route.components.filter((c) => c.type !== "semi-product");

  const [menuType, setMenuType] = useState<ComponentType | null>(null);
  const [query, setQuery] = useState("");
  const [showImportInfo, setShowImportInfo] = useState(false);

  /** Ранее добавленные компоненты того же типа из всех изделий, которых ещё нет в этом изделии. */
  const suggestions = useMemo(() => {
    if (!menuType) return [];
    const existing = new Set(
      groups.filter((g) => g.type === menuType).map((g) => g.name.trim().toLowerCase()),
    );
    const byName = new Map<string, ComponentGroup>();
    for (const p of products) {
      for (const c of p.components) {
        if (c.type !== menuType) continue;
        const key = c.name.trim().toLowerCase();
        if (!key || existing.has(key) || byName.has(key)) continue;
        byName.set(key, c);
      }
    }
    const q = query.trim().toLowerCase();
    return [...byName.values()]
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [menuType, products, groups, query]);

  /** Где уже используется компонент: ключ "тип|имя" -> список изделий. */
  const usageByComponent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of products) {
      for (const c of p.components) {
        const name = c.name.trim();
        if (c.type === "semi-product" || !name) continue;
        const key = `${c.type}|${name.toLowerCase()}`;
        const arr = map.get(key) ?? [];
        if (!arr.includes(p.name)) arr.push(p.name);
        map.set(key, arr);
      }
    }
    return map;
  }, [products]);

  const addExisting = (c: ComponentGroup) => {
    mutateRoute(target, (r) => ({
      ...r,
      components: [...r.components, JSON.parse(JSON.stringify({ ...c, id: uid() })) as ComponentGroup],
    }));
    setMenuType(null);
    setQuery("");
  };

  const addNewGroup = (t: ComponentType) => {
    mutateRoute(target, (r) => R.addComponent(r, t));
    setMenuType(null);
    setQuery("");
  };

  /** Обновить строку спецификации: имя хранится в компоненте, данные — в его единственной записи. */
  const updRow = (g: ComponentGroup, patch: Partial<Position> & { name?: string; unit?: string; type?: ComponentType; assemblyProductId?: string }) =>
    mutateRoute(target, (r) => {
      const { name, unit, type, assemblyProductId, ...pos } = patch;
      const base = g.positions[0] ?? { id: uid(), name: g.name, quantityPerUnit: 1, stock: 0, leadTimeDays: 0 };
      const cp: Partial<ComponentGroup> = {};
      if (name !== undefined) cp.name = name;
      if (unit !== undefined) cp.unit = unit;
      if (type !== undefined) cp.type = type;
      if (assemblyProductId !== undefined) cp.assemblyProductId = assemblyProductId || undefined;
      const positions = type === "fixture" ? [] : [{ ...base, ...pos, name: name ?? base.name }];
      return R.updateComponent(r, g.id, { ...cp, positions, ...(type === "fixture" ? { fixtureCount: g.fixtureCount ?? 1 } : {}) });
    });

  const importExcel = async (file: File) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
    const pick = (row: Record<string, unknown>, ...keys: string[]) => {
      const k = Object.keys(row).find((x) => keys.some((key) => x.toLowerCase().includes(key)));
      return k ? String(row[k] ?? "").trim() : "";
    };
    mutateRoute(target, (r) => {
      const added: ComponentGroup[] = [];
      for (const row of rows) {
        const name = pick(row, "наимен", "обознач");
        if (!name) continue;
        const type = TYPE_BY_TEXT[pick(row, "тип", "раздел").toLowerCase()] ?? "material";
        added.push({
          id: uid(), name, type, unit: pick(row, "ед") || "шт",
          fixtureCount: type === "fixture" ? Number(pick(row, "кол")) || 1 : undefined,
          positions: type === "fixture" ? [] : [{
            id: uid(), name,
            quantityPerUnit: Number(pick(row, "кол")) || 1, stock: 0,
            leadTimeDays: Number(pick(row, "срок")) || 0,
            supplier: pick(row, "постав") || undefined,
          }],
        });
      }
      return { ...r, components: [...r.components, ...added] };
    });
  };

  const sorted = [...groups].sort(
    (a, b) => COMPOSITION_TYPES.indexOf(a.type) - COMPOSITION_TYPES.indexOf(b.type) || a.name.localeCompare(b.name, "ru"),
  );
  const assemblyOptions = products.filter((p) => p.id !== productId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {COMPOSITION_TYPES.map((t) => (
          <div key={t} className="relative">
            <button type="button" onClick={() => { setMenuType(menuType === t ? null : t); setQuery(""); }}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary">
              <Plus className="h-3 w-3" /> {TYPE_LABEL[t]}
            </button>
            {menuType === t && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuType(null)} />
                <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lg">
                  <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Поиск ранее добавленных…" className={`${inp} w-full`} />
                  <div className="mt-2 max-h-60 overflow-auto">
                    {suggestions.length === 0 && (
                      <p className="px-2 py-1 text-[11px] text-muted-foreground">Нет ранее добавленных компонентов</p>
                    )}
                    {suggestions.map((c) => {
                      const usage = usageByComponent.get(`${c.type}|${c.name.trim().toLowerCase()}`) ?? [];
                      return (
                        <button key={c.id} type="button" onClick={() => addExisting(c)}
                          className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent">
                          <span>{c.name}</span>
                          {usage.length > 0 && (
                            <span className="block text-[10px] text-muted-foreground"
                              title={`Уже используется в изделиях: ${usage.join(", ")}`}>
                              Используется в: {usage.join(", ")}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => addNewGroup(t)}
                    className="mt-2 w-full rounded border-t border-border px-2 pt-2 text-left text-xs text-primary hover:underline">
                    + Создать новый
                  </button>
                  <p className="mt-1 px-2 text-[10px] leading-snug text-muted-foreground">
                    Компоненты копируются, а не ссылаются: изменение строки в одном изделии не меняет их в других.
                  </p>
                </div>
              </>
            )}
          </div>
        ))}
        <label className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
          <Upload className="h-3.5 w-3.5" /> Загрузить из Excel
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value = ""; }} />
        </label>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Формат файла Excel" title="Формат файла Excel" onClick={() => setShowImportInfo(true)}><Info className="h-4 w-4" /></Button>
      </div>

      {showImportInfo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4" onClick={() => setShowImportInfo(false)}>
        <div role="dialog" aria-modal="true" aria-label="Формат файла Excel" className="w-full max-w-lg space-y-3 rounded-md border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-semibold">Формат файла Excel</h2>
          <p className="text-sm">Первая строка первого листа — заголовки столбцов. Каждая следующая строка — отдельный компонент спецификации. Поддерживаются .xlsx, .xls и .csv.</p>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="py-1">Столбец</th><th>Что указать</th></tr></thead><tbody>
            <tr><td className="py-1 pr-3">Наименование</td><td>Название позиции; обязательно</td></tr>
            <tr><td className="py-1 pr-3">Ед. изм.</td><td>шт, г, м, компл; без него — шт</td></tr>
            <tr><td className="py-1 pr-3">Тип</td><td>Деталь, Сборочная единица, Стандартное изделие, Материал, ЭРИ, Упаковка или Оснастка; без него — Материал</td></tr>
            <tr><td className="py-1 pr-3">Кол-во на изделие</td><td>Число; без него — 1</td></tr>
            <tr><td className="py-1 pr-3">Поставщик</td><td>Необязательно</td></tr>
            <tr><td className="py-1 pr-3">Срок поставки (дн)</td><td>Число дней; без него — 0</td></tr>
          </tbody></table></div>
          <p className="text-xs text-muted-foreground">Пример: К10-17 0,1 мкФ · ЭРИ · 4 · шт · Поставщик А · 14. Строки добавляются к текущему составу, существующие не удаляются.</p>
          <div className="flex justify-end"><Button type="button" size="sm" onClick={() => setShowImportInfo(false)}>Закрыть</Button></div>
        </div>
      </div>}

      {groups.length === 0 ? <p className="text-sm text-muted-foreground">Состав пока пуст.</p> : (
        <div className="overflow-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted text-[10px] uppercase text-muted-foreground">
              <tr className="text-left">
                <th className="px-2 py-1 font-medium">Раздел</th>
                <th className="px-2 py-1 font-medium">Наименование / обозначение</th>
                <th className="px-2 py-1 font-medium">Кол-во</th>
                <th className="px-2 py-1 font-medium">Ед.</th>
                <th className="px-2 py-1 font-medium">Поставщик / узел</th>
                <th className="px-2 py-1 font-medium">Срок, дн</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((g) => {
                const p = g.positions[0];
                const self = products.find((x) => x.id === productId)?.name;
                const usage = (usageByComponent.get(`${g.type}|${g.name.trim().toLowerCase()}`) ?? []).filter((n) => n !== self);
                return (
                  <tr key={g.id} className="border-t border-border/60">
                    <td className="px-1 py-0.5">
                      <select aria-label={`Раздел ${g.name}`} className={`${inp} w-36`} value={g.type}
                        onChange={(e) => updRow(g, { type: e.target.value as ComponentType })}>
                        {COMPOSITION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                      </select>
                    </td>
                    <td className="px-1">
                      <input value={g.name} onChange={(e) => updRow(g, { name: e.target.value })} className={`${inp} w-full`}
                        title={usage.length ? `Используется также в: ${usage.join(", ")}` : undefined} />
                    </td>
                    <td className="px-1">
                      {g.type === "fixture" ? (
                        <input type="number" min={0} value={g.fixtureCount ?? 0} title="Оснастка не расходуется: количество в наличии"
                          onChange={(e) => mutateRoute(target, (r) => R.updateComponent(r, g.id, { fixtureCount: Number(e.target.value) }))}
                          className={`${inp} w-16`} />
                      ) : (
                        <input type="number" min={0} value={p?.quantityPerUnit ?? 1}
                          onChange={(e) => updRow(g, { quantityPerUnit: Number(e.target.value) })} className={`${inp} w-16`} />
                      )}
                    </td>
                    <td className="px-1">
                      <input value={g.unit ?? "шт"} onChange={(e) => updRow(g, { unit: e.target.value })} className={`${inp} w-14`} />
                    </td>
                    <td className="px-1">
                      {g.type === "assembly" ? (
                        <select aria-label="Узел из базы" className={`${inp} w-full`} value={g.assemblyProductId ?? ""}
                          onChange={(e) => updRow(g, { assemblyProductId: e.target.value })}>
                          <option value="">— изготавливается / не привязана —</option>
                          {assemblyOptions.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.version}</option>)}
                        </select>
                      ) : g.type === "fixture" ? <span className="px-2 text-muted-foreground">—</span> : (
                        <input value={p?.supplier ?? ""} onChange={(e) => updRow(g, { supplier: e.target.value })} className={`${inp} w-full`} />
                      )}
                    </td>
                    <td className="px-1">
                      {g.type !== "fixture" && (
                        <input type="number" min={0} value={p?.leadTimeDays ?? 0}
                          onChange={(e) => updRow(g, { leadTimeDays: Number(e.target.value) })} className={`${inp} w-14`} />
                      )}
                    </td>
                    <td className="px-1">
                      <button type="button" aria-label="Удалить строку" onClick={() => mutateRoute(target, (r) => R.removeComponent(r, g.id))}
                        className="p-1 text-muted-foreground hover:text-status-block"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Составными могут быть только сборочные единицы: привяжите их к изделию из базы, чтобы её состав и маршрут велись отдельно.
      </p>
    </div>
  );
}
