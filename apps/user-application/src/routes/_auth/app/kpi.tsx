import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { missionsSeed, summarizeMissionKpis } from "@/core/contracts/nafa-operations";

export const Route = createFileRoute("/_auth/app/kpi")({
  component: RouteComponent,
});

function RouteComponent() {
  const kpis = summarizeMissionKpis(missionsSeed);
  const cards = [
    { title: "Completion Rate", value: `${kpis.completionRate}%` },
    { title: "On-Time Departure", value: `${kpis.onTimeDepartureRate}%` },
    { title: "On-Time Arrival", value: `${kpis.onTimeArrivalRate}%` },
    { title: "Active Missions", value: String(kpis.activeMissionCount) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardDescription>{card.title}</CardDescription>
            <CardTitle className="text-3xl">{card.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Last refreshed from current mission state.
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
