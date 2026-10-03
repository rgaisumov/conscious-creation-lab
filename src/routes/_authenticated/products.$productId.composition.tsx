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

  const setPositions = (g: ComponentGroup, positions: Position[]) =>
    mutateRoute(target, (r) => R.updateComponent(r, g.id, { positions }));

  const importExcel = async (file: File) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
    const pick = (row: Record<string, unknown>, ...keys: string[]) => {
      const k = Object.keys(row).find((x) => keys.some((key) => x.toLowerCase().includes(key)));
      return k ? String(row[k] ?? "").trim() : "";
    };
    mutateRoute(target, (r) => {
      let next = r;
      for (const row of rows) {
        const name = pick(row, "наимен", "позиц");
        if (!name) continue;
        const groupName = pick(row, "групп", "компонент") || "Импорт";
        const type = TYPE_BY_TEXT[pick(row, "тип").toLowerCase()] ?? "material";
        let g = next.components.find((c) => c.name === groupName && c.type !== "semi-product");
        if (!g) {
          next = R.addComponent(next, type);
          const added = next.components[next.components.length - 1];
          next = R.updateComponent(next, added.id, { name: groupName, positions: [] });
          g = next.components.find((c) => c.id === added.id)!;
        }
        const pos: Position = {
          id: uid(), name,
          quantityPerUnit: Number(pick(row, "кол")) || 1,
          stock: 0,
          leadTimeDays: Number(pick(row, "срок")) || 0,
          supplier: pick(row, "постав") || undefined,
        };
        next = R.updateComponent(next, g.id, { positions: [...g.positions, pos] });
      }
      return next;
    });
  };

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
                          <span>{c.name} <span className="text-muted-foreground">· {c.positions.length} поз.</span></span>
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
                    Компоненты копируются, а не ссылаются: изменение позиций в одном изделии не меняет их в других.
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
          <p className="text-sm">Первая строка первого листа — заголовки столбцов. Каждая следующая строка — отдельная позиция. Поддерживаются .xlsx, .xls и .csv.</p>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="py-1">Столбец</th><th>Что указать</th></tr></thead><tbody>
            <tr><td className="py-1 pr-3">Наименование</td><td>Название позиции; обязательно</td></tr>
            <tr><td className="py-1 pr-3">Группа</td><td>Название группы; без него — «Импорт»</td></tr>
            <tr><td className="py-1 pr-3">Тип</td><td>Деталь, Сборочная единица, Стандартное изделие, Материал, ЭРИ, Упаковка или Оснастка; без него — Материал</td></tr>
            <tr><td className="py-1 pr-3">Кол-во на изделие</td><td>Число; без него — 1</td></tr>
            <tr><td className="py-1 pr-3">Поставщик</td><td>Необязательно</td></tr>
            <tr><td className="py-1 pr-3">Срок поставки (дн)</td><td>Число дней; без него — 0</td></tr>
          </tbody></table></div>
          <p className="text-xs text-muted-foreground">Пример: Конденсаторы · ЭРИ · К10-17 · 4 · Поставщик А · 14. Позиции добавляются к текущему составу, существующие не удаляются.</p>
          <div className="flex justify-end"><Button type="button" size="sm" onClick={() => setShowImportInfo(false)}>Закрыть</Button></div>
        </div>
      </div>}

      {groups.length === 0 && <p className="text-sm text-muted-foreground">Состав пока пуст.</p>}
      {groups.map((g) => (
        <div key={g.id} className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <input value={g.name} className={`${inp} flex-1 font-medium`}
              onChange={(e) => mutateRoute(target, (r) => R.updateComponent(r, g.id, { name: e.target.value }))} />
            {(() => {
              const self = products.find((p) => p.id === productId)?.name;
              const usage = (usageByComponent.get(`${g.type}|${g.name.trim().toLowerCase()}`) ?? []).filter((n) => n !== self);
              if (usage.length === 0) return null;
              return (
                <span className="max-w-48 truncate text-[11px] text-muted-foreground"
                  title={`Используется в изделиях: ${usage.join(", ")}`}>
                  Используется в: {usage.join(", ")}
                </span>
              );
            })()}
            <select aria-label={`Тип группы ${g.name}`} className={inp} value={g.type}
              onChange={(e) => mutateRoute(target, (r) => R.updateComponent(r, g.id, { type: e.target.value as ComponentType }))}>
              {COMPOSITION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <button type="button" aria-label="Удалить группу" onClick={() => mutateRoute(target, (r) => R.removeComponent(r, g.id))}
              className="p-1 text-muted-foreground hover:text-status-block"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          <table className="mt-2 w-full text-xs">
            <thead className="text-[10px] uppercase text-muted-foreground">
              <tr><th className="py-1 text-left font-medium">Наименование</th><th className="text-left font-medium">Кол-во на изд.</th>
                <th className="text-left font-medium">Поставщик</th><th className="text-left font-medium">Срок, дн</th><th /></tr>
            </thead>
            <tbody>
              {g.positions.map((p) => {
                const upd = (patch: Partial<Position>) =>
                  setPositions(g, g.positions.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
                return (
                  <tr key={p.id}>
                    <td className="py-0.5 pr-2"><input value={p.name} onChange={(e) => upd({ name: e.target.value })} className={`${inp} w-full`} /></td>
                    <td className="pr-2"><input type="number" min={0} value={p.quantityPerUnit} onChange={(e) => upd({ quantityPerUnit: Number(e.target.value) })} className={`${inp} w-20`} /></td>
                    <td className="pr-2"><input value={p.supplier ?? ""} onChange={(e) => upd({ supplier: e.target.value })} className={`${inp} w-full`} /></td>
                    <td className="pr-2"><input type="number" min={0} value={p.leadTimeDays} onChange={(e) => upd({ leadTimeDays: Number(e.target.value) })} className={`${inp} w-16`} /></td>
                    <td><button type="button" aria-label="Удалить позицию" onClick={() => setPositions(g, g.positions.filter((x) => x.id !== p.id))}
                      className="p-1 text-muted-foreground hover:text-status-block"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button type="button"
            onClick={() => setPositions(g, [...g.positions, { id: uid(), name: "Новая позиция", quantityPerUnit: 1, stock: 0, leadTimeDays: 0 }])}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary">
            <Plus className="h-3 w-3" /> позиция
          </button>
        </div>
      ))}
    </div>
  );
}
