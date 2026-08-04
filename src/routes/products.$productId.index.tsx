import { createFileRoute } from "@tanstack/react-router";
import { RouteEditor } from "@/components/route/RouteEditor";

export const Route = createFileRoute("/products/$productId/")({
  component: ProductRouteEditorPage,
});

function ProductRouteEditorPage() {
  const { productId } = Route.useParams();
  return <RouteEditor target={{ kind: "product", productId }} />;
}
