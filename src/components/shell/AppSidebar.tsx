import { useState, type ChangeEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Workflow,
  GitBranch,
  Package,
  Factory,
  ShoppingCart,
  BarChart3,
  Settings,
  ChevronRight,
  Save,
  Upload,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useProduction } from "@/lib/production/store";
import type { Product } from "@/lib/production/types";

const NAV_ITEMS = [
  { to: "/", label: "Изделия", icon: LayoutDashboard, exact: true },
  { to: "/flow", label: "Тех.маршрут", icon: Workflow },
  { to: "/graph", label: "Граф", icon: GitBranch },
  { to: "/components", label: "Компоненты", icon: Package },
  { to: "/production", label: "Производство", icon: Factory },
  { to: "/purchases", label: "Закупки", icon: ShoppingCart },
  { to: "/analytics", label: "Аналитика", icon: BarChart3 },
  { to: "/settings", label: "Настройки", icon: Settings },
] as const;

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { product, setProduct } = useProduction();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  function exportJson() {
    const blob = new Blob([JSON.stringify(product, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${product.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importJson(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        setProduct(JSON.parse(String(r.result)) as Product);
      } catch (err) {
        console.error("Import failed", err);
      }
    };
    r.readAsText(f);
  }

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all shrink-0",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
        <div className="h-8 w-8 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
          <Workflow className="h-4 w-4 text-primary" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">Производство</div>
            <div className="text-xs text-muted-foreground truncate">{product.name}</div>
          </div>
        )}
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-2 border-transparent",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="p-2 border-t border-sidebar-border flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="justify-start" onClick={exportJson}>
          <Save className="h-4 w-4" />
          {!collapsed && <span>Сохранить</span>}
        </Button>
        <label className="cursor-pointer">
          <input type="file" accept="application/json" onChange={importJson} className="hidden" />
          <div className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-sidebar-accent/50 text-sidebar-foreground/80">
            <Upload className="h-4 w-4" />
            {!collapsed && <span>Загрузить</span>}
          </div>
        </label>
        <Button variant="ghost" size="sm" className="justify-start" onClick={() => setCollapsed((v) => !v)}>
          <ChevronRight className={cn("h-4 w-4 transition", !collapsed && "rotate-180")} />
          {!collapsed && <span>Свернуть</span>}
        </Button>
      </div>
    </aside>
  );
}
