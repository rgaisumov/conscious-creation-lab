import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Factory, Boxes, FileText, Settings, Moon, Sun, Gauge, LogOut } from "lucide-react";
import { useProduction } from "@/lib/production/store";
import { supabase } from "@/integrations/supabase/client";


const items = [
  { title: "Производство", url: "/", icon: Factory },
  { title: "Изделия", url: "/products", icon: Boxes },
  { title: "Участки", url: "/workcenters", icon: Gauge },
  { title: "Договоры", url: "/contracts", icon: FileText },
  { title: "Настройки", url: "/settings", icon: Settings },
];


const ROLE_LABEL: Record<string, string> = {
  admin: "Администратор",
  production_manager: "Начальник производства",
  workcenter_master: "Мастер участка",
  viewer: "Наблюдатель",
};

export function AppSidebar() {
  const { theme, toggleTheme, batches, loading, role, saving, saveError } = useProduction();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-sidebar flex flex-col">
      <div className="px-4 py-4 border-b border-border">
        <div className="text-sm font-semibold tracking-wide text-sidebar-foreground">
          Управление производством
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {loading ? "Загрузка данных…" : `${batches.length} активных партий`}
        </div>
        {role && <div className="mt-1 text-xs text-muted-foreground">{ROLE_LABEL[role] ?? role}</div>}
        {saving && <div className="mt-1 text-xs text-muted-foreground">Сохранение…</div>}
        {saveError && <div className="mt-1 text-xs text-destructive">Ошибка сохранения</div>}
      </div>


      <nav className="flex-1 p-2 space-y-1">
        {items.map((item) => (
          <Link
            key={item.url}
            to={item.url}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive(item.url)
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        ))}
      </nav>

      <div className="p-2 border-t border-border">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Светлая тема" : "Тёмная тема"}
        </button>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </button>
      </div>

    </aside>
  );
}
