import { createFileRoute } from "@tanstack/react-router";
import { GraphEditor } from "@/components/route/GraphEditor";

export const Route = createFileRoute("/products/$productId/graph")({
  component: ProductGraphEditorPage,
});

function ProductGraphEditorPage() {
  const { productId } = Route.useParams();
  return <GraphEditor target={{ kind: "product", productId }} />;
}
