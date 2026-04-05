import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import type { Mission, MissionExceptionEvent } from "@/core/contracts/nafa-operations";
import {
  buildThirtyDayKpiTrend,
  missionsSeed,
  summarizeDelayReasonMix,
  summarizeMissionKpis,
} from "@/core/contracts/nafa-operations";

export const Route = createFileRoute("/_auth/app/kpi")({
  component: RouteComponent,
});

function RouteComponent() {
  const [routeFilter, setRouteFilter] = useState("all");
  const [depotFilter, setDepotFilter] = useState("all");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toISOString());
  const [exportNotice, setExportNotice] = useState<string>("");

  const routeOptions = useMemo(
    () => Array.from(new Set(missionsSeed.map((mission) => mission.route))),
    [],
  );
  const depotOptions = useMemo(
    () =>
      Array.from(
        new Set(
          missionsSeed.flatMap((mission) =>
            mission.route.split("->").map((depot) => depot.trim()),
          ),
        ),
      ),
    [],
  );

  const filteredMissions = useMemo(() => {
    return missionsSeed.filter((mission) => {
      if (routeFilter !== "all" && mission.route !== routeFilter) {
        return false;
      }

      if (depotFilter !== "all" && !mission.route.toLowerCase().includes(depotFilter.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [routeFilter, depotFilter]);

  const kpis = summarizeMissionKpis(filteredMissions);
  const trend = useMemo(
    () => buildThirtyDayKpiTrend(filteredMissions, "2026-04-05"),
    [filteredMissions],
  );

  const exceptionEvents: Array<MissionExceptionEvent> = [
    {
      id: "kpi-ex-1",
      missionId: "M-2401",
      reason: "delay",
      note: "Road traffic near Anyama",
      timestamp: "2026-04-05T08:55:00.000Z",
    },
    {
      id: "kpi-ex-2",
      missionId: "M-2403",
      reason: "breakdown",
      note: "Cooling alert",
      timestamp: "2026-04-05T10:20:00.000Z",
    },
    {
      id: "kpi-ex-3",
      missionId: "M-2398",
      reason: "delay",
      note: "Port gate queue",
      timestamp: "2026-04-04T14:00:00.000Z",
    },
  ];
  const filteredMissionIds = new Set(filteredMissions.map((mission) => mission.id));
  const delayReasonMix = summarizeDelayReasonMix(
    exceptionEvents.filter((exception) => filteredMissionIds.has(exception.missionId)),
  );

  const exportRows = useMemo(() => {
    return filteredMissions.map((mission: Mission) => ({
      missionId: mission.id,
      route: mission.route,
      serviceDate: mission.serviceDate ?? "",
      status: mission.status,
      onTimeDeparture: mission.onTimeDeparture ? "yes" : "no",
      onTimeArrival: mission.onTimeArrival ? "yes" : "no",
    }));
  }, [filteredMissions]);

  const handleRefresh = () => {
    setLastRefreshedAt(new Date().toISOString());
    setExportNotice("");
  };

  const handleExport = (format: "csv" | "pdf") => {
    if (format === "csv") {
      const header = "missionId,route,serviceDate,status,onTimeDeparture,onTimeArrival";
      const rows = exportRows.map((row) =>
        [
          row.missionId,
          `"${row.route}"`,
          row.serviceDate,
          row.status,
          row.onTimeDeparture,
          row.onTimeArrival,
        ].join(","),
      );

      const content = [header, ...rows].join("\n");
      const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "nafa-kpi-report.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      setExportNotice("CSV report exported.");
      return;
    }

    const placeholderPdfContent =
      "Nafa KPI report export placeholder. PDF rendering pipeline pending.";
    const blob = new Blob([placeholderPdfContent], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nafa-kpi-report.pdf";
    anchor.click();
    URL.revokeObjectURL(url);
    setExportNotice("PDF export trigger executed.");
  };

  const cards = [
    { title: "Completion Rate", value: `${kpis.completionRate}%` },
    { title: "On-Time Departure", value: `${kpis.onTimeDepartureRate}%` },
    { title: "On-Time Arrival", value: `${kpis.onTimeArrivalRate}%` },
    { title: "Active Missions", value: String(kpis.activeMissionCount) },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>KPI Filters And Exports</CardTitle>
          <CardDescription>
            30-day dashboard window with operational route/depot filtering and report export triggers.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_auto_auto]">
          <Select value={routeFilter} onValueChange={(value) => setRouteFilter(value ?? "all")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All routes</SelectItem>
              {routeOptions.map((route) => (
                <SelectItem key={route} value={route}>
                  {route}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={depotFilter} onValueChange={(value) => setDepotFilter(value ?? "all")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All depots</SelectItem>
              {depotOptions.map((depot) => (
                <SelectItem key={depot} value={depot}>
                  {depot}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="secondary" onClick={handleRefresh}>
            Refresh KPI
          </Button>
          <Button variant="outline" onClick={() => handleExport("csv")}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport("pdf")}>
            Export PDF
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardDescription>{card.title}</CardDescription>
              <CardTitle className="text-3xl">{card.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Last refreshed at {new Date(lastRefreshedAt).toLocaleTimeString()}.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>30-Day Trend</CardTitle>
            <CardDescription>
              Daily mission trend points for completion and on-time performance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {trend.slice(-7).map((point) => (
              <div
                key={point.date}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>{point.date}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Missions {point.totalMissions}</Badge>
                  <Badge variant="outline">Completion {point.completionRate}%</Badge>
                  <Badge variant="outline">OTD {point.onTimeDepartureRate}%</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delay Reason Mix</CardTitle>
            <CardDescription>
              Exception mix for the selected slice.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(delayReasonMix).map(([reason, count]) => (
              <div
                key={reason}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="capitalize">{reason.replace("_", " ")}</span>
                <Badge>{count}</Badge>
              </div>
            ))}
            {exportNotice ? (
              <p className="pt-1 text-xs text-muted-foreground">{exportNotice}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
