import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/shell/StubPage";

export const Route = createFileRoute("/production")({
  head: () => ({
    meta: [
      { title: "Производство — скоро" },
      { name: "description", content: "Раздел «Производство» появится позже." },
      { property: "og:title", content: "Производство" },
      { property: "og:description", content: "Раздел в разработке." },
    ],
  }),
  component: () => <StubPage title="Производство" description="Оперативный экран цеха: смены, загрузка, оперативные метки." />,
});
