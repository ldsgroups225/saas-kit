import { Outlet, createFileRoute } from "@tanstack/react-router";
import { NavigationBar } from "@/components/navigation";

export const Route = createFileRoute("/_static")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationBar />
      <main className="pt-16">
        <Outlet />
      </main>
    </div>
  );
}
