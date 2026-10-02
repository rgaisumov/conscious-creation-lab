import { createFileRoute, Link } from "@tanstack/react-router";
import { useProduction } from "@/lib/production/store";

export const Route = createFileRoute("/_authenticated/products/$productId/batches")({
  head: () => ({
    meta: [
      { title: "Партии изделия" },
      { name: "description", content: "Список производственных партий выбранного изделия." },
      { property: "og:title", content: "Партии изделия" },
      { property: "og:description", content: "Партии, запущенные по изделию." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductBatchesPage,
});

function ProductBatchesPage() {
  const { productId } = Route.useParams();
  const { batches, summaryOf } = useProduction();
  const own = batches.filter((b) => b.productId === productId);
  if (own.length === 0) return <p className="text-sm text-muted-foreground">Партий по этому изделию пока нет.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="py-1.5 text-left font-medium">Партия</th>
          <th className="text-right font-medium">Кол-во</th>
          <th className="text-right font-medium">Отгружено</th>
          <th className="text-left font-medium pl-4">Срок</th>
          <th className="text-left font-medium">Состояние</th>
        </tr>
      </thead>
      <tbody>
        {own.map((b) => {
          const s = summaryOf(b);
          return (
            <tr key={b.id} className="border-t border-border">
              <td className="py-1.5">
                <Link to="/batches/$batchId" params={{ batchId: b.id }} className="text-primary hover:underline">
                  {b.number}
                </Link>
              </td>
              <td className="text-right tabular-nums">{b.orderedQty}</td>
              <td className="text-right tabular-nums">{s.shipped}</td>
              <td className="pl-4 text-xs">{b.dueDate}</td>
              <td className="text-xs text-muted-foreground">{s.primaryBlockingReason}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
