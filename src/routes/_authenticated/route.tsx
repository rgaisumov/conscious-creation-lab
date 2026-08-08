import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ProductionProvider } from "@/lib/production/store";
import { AppSidebar } from "@/components/shell/AppSidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <ProductionProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <Outlet />
        </div>
      </div>
    </ProductionProvider>
  );
}
