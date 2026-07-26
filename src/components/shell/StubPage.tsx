import { Construction } from "lucide-react";

export function StubPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
          <Construction className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold mb-1">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground mt-3">Раздел в разработке.</p>
      </div>
    </div>
  );
}
