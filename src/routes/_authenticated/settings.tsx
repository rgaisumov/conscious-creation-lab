import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { Download, Upload } from "lucide-react";
import { useProduction } from "@/lib/production/store";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Настройки — тема и данные производства" },
      {
        name: "description",
        content: "Настройки системы: светлая и тёмная тема, экспорт и импорт данных изделий и партий в JSON.",
      },
      { property: "og:title", content: "Настройки — тема и данные производства" },
      { property: "og:description", content: "Тема оформления и резервное копирование данных в JSON." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme, exportState, importState } = useProduction();
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([JSON.stringify(exportState(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "production-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Настройки</h1>
      </header>

      <div className="max-w-xl space-y-6 p-6">
        <section>
          <h2 className="text-sm font-medium">Тема оформления</h2>
          <div className="mt-2 flex gap-2">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`rounded-md border px-3 py-1.5 text-xs ${
                  theme === t ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground"
                }`}
              >
                {t === "light" ? "Светлая" : "Тёмная"}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium">Данные</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Изделия и партии хранятся локально в браузере. Выгрузите JSON, чтобы сохранить или перенести.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={download}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/50"
            >
              <Download className="h-3.5 w-3.5" /> Выгрузить JSON
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/50"
            >
              <Upload className="h-3.5 w-3.5" /> Загрузить JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  importState(JSON.parse(await file.text()));
                } catch {
                  /* игнорируем некорректный файл */
                }
                e.target.value = "";
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
