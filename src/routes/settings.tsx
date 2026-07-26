import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/shell/StubPage";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Настройки — скоро" },
      { name: "description", content: "Раздел «Настройки» появится позже." },
      { property: "og:title", content: "Настройки" },
      { property: "og:description", content: "Раздел в разработке." },
    ],
  }),
  component: () => <StubPage title="Настройки" description="Пользователи, роли, единицы измерения, тема оформления." />,
});
