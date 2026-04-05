import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Alert } from "@workspace/ui/components/alert";
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
import type { Mission, MissionStatus } from "@/core/contracts/nafa-operations";
import {
  canAssignMission,
  fleetAssetsSeed,
  getNextMissionStatuses,
  missionsSeed,
  summarizeMissionKpis,
} from "@/core/contracts/nafa-operations";

export const Route = createFileRoute("/_auth/app/")({
  component: RouteComponent,
});

const missionStatusTone: Record<MissionStatus, string> = {
  Draft: "bg-zinc-200 text-zinc-900",
  Assigned: "bg-sky-100 text-sky-900",
  "In Transit": "bg-amber-100 text-amber-900",
  Completed: "bg-emerald-100 text-emerald-900",
  Cancelled: "bg-rose-100 text-rose-900",
};

function RouteComponent() {
  const [missions, setMissions] = useState<Array<Mission>>(missionsSeed);
  const [selectedMissionId, setSelectedMissionId] = useState(missionsSeed[1]?.id ?? "");
  const [vehicleId, setVehicleId] = useState(
    fleetAssetsSeed.find((item) => item.kind === "vehicle")?.id ?? "",
  );
  const [driverId, setDriverId] = useState(
    fleetAssetsSeed.find((item) => item.kind === "driver")?.id ?? "",
  );

  const kpis = useMemo(() => summarizeMissionKpis(missions), [missions]);
  const vehicleOptions = fleetAssetsSeed.filter((item) => item.kind === "vehicle");
  const driverOptions = fleetAssetsSeed.filter((item) => item.kind === "driver");
  const selectedVehicle = vehicleOptions.find((item) => item.id === vehicleId);
  const selectedDriver = driverOptions.find((item) => item.id === driverId);
  const assignmentCheck = canAssignMission({
    vehicle: selectedVehicle,
    driver: selectedDriver,
  });
  const selectedMission = missions.find((mission) => mission.id === selectedMissionId);

  const handleStatusAdvance = (missionId: string, nextStatus: MissionStatus) => {
    setMissions((prev) =>
      prev.map((mission) =>
        mission.id === missionId
          ? {
              ...mission,
              status: nextStatus,
              updatedAt: new Date().toISOString(),
            }
          : mission,
      ),
    );
  };

  const handleAssign = () => {
    if (!selectedMission || !assignmentCheck.allowed) {
      return;
    }

    setMissions((prev) =>
      prev.map((mission) =>
        mission.id === selectedMission.id
          ? {
              ...mission,
              status: "Assigned",
              assignedVehicleId: selectedVehicle?.id,
              assignedDriverId: selectedDriver?.id,
              updatedAt: new Date().toISOString(),
            }
          : mission,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Completion"
          value={`${kpis.completionRate}%`}
          caption="Mission close rate"
        />
        <KpiCard
          title="On-Time Departure"
          value={`${kpis.onTimeDepartureRate}%`}
          caption="Across active window"
        />
        <KpiCard
          title="On-Time Arrival"
          value={`${kpis.onTimeArrivalRate}%`}
          caption="Operational punctuality"
        />
        <KpiCard
          title="Active Missions"
          value={String(kpis.activeMissionCount)}
          caption="Assigned + In Transit"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Mission Board</CardTitle>
            <CardDescription>
              Dispatch queue with valid lifecycle transitions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {missions.map((mission) => {
              const allowedTransitions = getNextMissionStatuses(mission.status);
              return (
                <div
                  key={mission.id}
                  className="rounded-xl border border-border bg-background/60 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {mission.id}
                      </p>
                      <p className="text-sm text-muted-foreground">{mission.route}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={missionStatusTone[mission.status]}>
                        {mission.status}
                      </Badge>
                      <Badge variant="outline">{mission.priority}</Badge>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {allowedTransitions.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        No further transitions
                      </span>
                    ) : (
                      allowedTransitions.map((nextStatus) => (
                        <Button
                          key={nextStatus}
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStatusAdvance(mission.id, nextStatus)}
                        >
                          Move to {nextStatus}
                        </Button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assignment Console</CardTitle>
              <CardDescription>
                Pair draft missions with available assets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={selectedMissionId}
                onValueChange={(value) => setSelectedMissionId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {missions
                    .filter(
                      (mission) =>
                        mission.status === "Draft" || mission.status === "Assigned",
                    )
                    .map((mission) => (
                      <SelectItem key={mission.id} value={mission.id}>
                        {mission.id} • {mission.route}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select
                value={vehicleId}
                onValueChange={(value) => setVehicleId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vehicleOptions.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.label} ({vehicle.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={driverId}
                onValueChange={(value) => setDriverId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {driverOptions.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.label} ({driver.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!assignmentCheck.allowed && (
                <Alert variant="destructive">{assignmentCheck.reason}</Alert>
              )}

              <Button
                className="w-full"
                disabled={!assignmentCheck.allowed || !selectedMission}
                onClick={handleAssign}
              >
                Confirm Assignment
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fleet Readiness</CardTitle>
              <CardDescription>
                Availability status synced to assignment guardrails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {fleetAssetsSeed.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{asset.label}</p>
                    <p className="text-xs text-muted-foreground">{asset.kind}</p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={asset.status === "active" ? "default" : "secondary"}
                    >
                      {asset.status}
                    </Badge>
                    {asset.reason ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {asset.reason}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  title,
  value,
  caption,
}: {
  title: string;
  value: string;
  caption: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  );
}
