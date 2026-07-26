import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/shell/StubPage";

export const Route = createFileRoute("/purchases")({
  head: () => ({
    meta: [
      { title: "Закупки — скоро" },
      { name: "description", content: "Раздел «Закупки» появится позже." },
      { property: "og:title", content: "Закупки" },
      { property: "og:description", content: "Раздел в разработке." },
    ],
  }),
  component: () => <StubPage title="Закупки" description="Заявки на закупку, сроки поставки, приход материалов." />,
});
