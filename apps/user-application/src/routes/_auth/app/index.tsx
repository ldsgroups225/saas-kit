import { createFileRoute } from '@tanstack/react-router'
import { DashboardHome } from "@/components/dashboard/dashboard-home";

export const Route = createFileRoute('/_auth/app/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <DashboardHome />;
}
