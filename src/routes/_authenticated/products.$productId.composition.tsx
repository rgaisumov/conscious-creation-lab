import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { useProduction } from "@/lib/production/store";
import * as R from "@/lib/production/route-ops";
import type { ComponentGroup, ComponentType, Position } from "@/lib/production/types";
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
        {(["material", "eri", "fixture"] as ComponentType[]).map((t) => (
          <button key={t} type="button" onClick={() => mutateRoute(target, (r) => R.addComponent(r, t))}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary">
            <Plus className="h-3 w-3" /> {TYPE_LABEL[t]}
          </button>
        ))}
        <label className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
          <Upload className="h-3.5 w-3.5" /> Загрузить из Excel
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importExcel(f); e.target.value = ""; }} />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Колонки Excel: Группа, Тип (Материал / ЭРИ / Оснастка), Наименование, Кол-во на изделие, Поставщик, Срок поставки (дн).
      </p>

      {groups.length === 0 && <p className="text-sm text-muted-foreground">Состав пока пуст.</p>}
      {groups.map((g) => (
        <div key={g.id} className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <input value={g.name} className={`${inp} flex-1 font-medium`}
              onChange={(e) => mutateRoute(target, (r) => R.updateComponent(r, g.id, { name: e.target.value }))} />
            <span className="text-[11px] text-muted-foreground">{TYPE_LABEL[g.type]}</span>
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
