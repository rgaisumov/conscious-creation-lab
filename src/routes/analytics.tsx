import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/shell/StubPage";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Аналитика — скоро" },
      { name: "description", content: "Раздел «Аналитика» появится позже." },
      { property: "og:title", content: "Аналитика" },
      { property: "og:description", content: "Раздел в разработке." },
    ],
  }),
  component: () => <StubPage title="Аналитика" description="Прогнозы, узкие места по времени, сроки выпуска партий." />,
});
