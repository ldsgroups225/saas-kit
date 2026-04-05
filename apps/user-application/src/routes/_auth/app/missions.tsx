import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Alert } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import type {
  Mission,
  MissionAssignmentEvent,
  MissionExceptionEvent,
  MissionExceptionReason,
  MissionStatus,
  MissionStatusEvent,
} from "@/core/contracts/nafa-operations";
import {
  buildMissionTimeline,
  canAssignMission,
  filterMissions,
  fleetAssetsSeed,
  formatExceptionReason,
  getNextMissionStatuses,
  missionsSeed,
} from "@/core/contracts/nafa-operations";

export const Route = createFileRoute("/_auth/app/missions")({
  component: RouteComponent,
});

const missionStatusTone: Record<MissionStatus, string> = {
  Draft: "bg-zinc-200 text-zinc-900",
  Assigned: "bg-sky-100 text-sky-900",
  "In Transit": "bg-amber-100 text-amber-900",
  Completed: "bg-emerald-100 text-emerald-900",
  Cancelled: "bg-rose-100 text-rose-900",
};

const exceptionReasonOptions: Array<MissionExceptionReason> = [
  "delay",
  "breakdown",
  "reroute",
  "no_show",
];

const defaultMission = missionsSeed[0];

function nextMissionId(missions: Array<Mission>): string {
  const maxNumericPart = missions.reduce((max, mission) => {
    const numericPart = Number.parseInt(mission.id.replace(/^M-/, ""), 10);
    if (Number.isNaN(numericPart)) {
      return max;
    }

    return Math.max(max, numericPart);
  }, 0);

  return `M-${maxNumericPart + 1}`;
}

function RouteComponent() {
  const vehicleOptions = fleetAssetsSeed.filter((asset) => asset.kind === "vehicle");
  const driverOptions = fleetAssetsSeed.filter((asset) => asset.kind === "driver");

  const [missions, setMissions] = useState<Array<Mission>>(missionsSeed);
  const [statusEvents, setStatusEvents] = useState<Array<MissionStatusEvent>>(
    missionsSeed.map((mission) => ({
      id: `status-initial-${mission.id}`,
      missionId: mission.id,
      toStatus: mission.status,
      timestamp: mission.updatedAt,
    }))
  );
  const [assignmentEvents, setAssignmentEvents] = useState<Array<MissionAssignmentEvent>>(
    missionsSeed
      .filter((mission) => mission.assignedVehicleId && mission.assignedDriverId)
      .map((mission) => ({
        id: `assignment-initial-${mission.id}`,
        missionId: mission.id,
        vehicleLabel: vehicleOptions.find((item) => item.id === mission.assignedVehicleId)?.label ?? mission.assignedVehicleId ?? "Unknown vehicle",
        driverLabel: driverOptions.find((item) => item.id === mission.assignedDriverId)?.label ?? mission.assignedDriverId ?? "Unknown driver",
        timestamp: mission.updatedAt,
      }))
  );
  const [exceptionEvents, setExceptionEvents] = useState<Array<MissionExceptionEvent>>([]);

  const [filters, setFilters] = useState({
    query: "",
    serviceDateFrom: "",
    serviceDateTo: "",
    driverId: "all",
    vehicleId: "all",
  });
  const [selectedMissionId, setSelectedMissionId] = useState(defaultMission?.id ?? "");

  const [newRoute, setNewRoute] = useState("");
  const [newPriority, setNewPriority] = useState<Mission["priority"]>("Normal");
  const [newServiceDate, setNewServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [intakeVehicleId, setIntakeVehicleId] = useState(vehicleOptions[0]?.id ?? "");
  const [intakeDriverId, setIntakeDriverId] = useState(driverOptions[0]?.id ?? "");
  const [intakeError, setIntakeError] = useState("");
  const [intakeNotice, setIntakeNotice] = useState("");

  const [exceptionReason, setExceptionReason] = useState<MissionExceptionReason>("delay");
  const [exceptionNote, setExceptionNote] = useState("");
  const [exceptionError, setExceptionError] = useState("");

  const filteredMissions = useMemo(
    () =>
      filterMissions(missions, {
        query: filters.query,
        serviceDateFrom: filters.serviceDateFrom || undefined,
        serviceDateTo: filters.serviceDateTo || undefined,
        driverId: filters.driverId === "all" ? undefined : filters.driverId,
        vehicleId: filters.vehicleId === "all" ? undefined : filters.vehicleId,
      }),
    [filters, missions]
  );

  const selectedMission =
    missions.find((mission) => mission.id === selectedMissionId) ?? filteredMissions[0];

  const selectedTimeline = useMemo(() => {
    if (!selectedMission) {
      return [];
    }

    return buildMissionTimeline({
      missionId: selectedMission.id,
      statusEvents,
      assignmentEvents,
      exceptionEvents,
    });
  }, [assignmentEvents, exceptionEvents, selectedMission, statusEvents]);

  const intakeVehicle = vehicleOptions.find((item) => item.id === intakeVehicleId);
  const intakeDriver = driverOptions.find((item) => item.id === intakeDriverId);
  const intakeAssignmentCheck = canAssignMission({
    vehicle: intakeVehicle,
    driver: intakeDriver,
  });

  const updateMission = (missionId: string, updater: (mission: Mission) => Mission) => {
    setMissions((previous) =>
      previous.map((mission) => (mission.id === missionId ? updater(mission) : mission))
    );
  };

  const handleStatusTransition = (mission: Mission, nextStatus: MissionStatus) => {
    const timestamp = new Date().toISOString();
    updateMission(mission.id, (currentMission) => ({
      ...currentMission,
      status: nextStatus,
      updatedAt: timestamp,
    }));

    setStatusEvents((previous) => [
      ...previous,
      {
        id: `status-${crypto.randomUUID()}`,
        missionId: mission.id,
        fromStatus: mission.status,
        toStatus: nextStatus,
        timestamp,
      },
    ]);
  };

  const handleCreateMission = (assignImmediately: boolean) => {
    setIntakeError("");
    setIntakeNotice("");

    if (!newRoute.trim()) {
      setIntakeError("Route is required.");
      return;
    }

    if (!newServiceDate) {
      setIntakeError("Service date is required.");
      return;
    }

    if (assignImmediately && !intakeAssignmentCheck.allowed) {
      setIntakeError(intakeAssignmentCheck.reason ?? "Mission cannot be assigned with selected assets.");
      return;
    }

    const id = nextMissionId(missions);
    const timestamp = new Date().toISOString();

    const mission: Mission = {
      id,
      route: newRoute.trim(),
      priority: newPriority,
      status: assignImmediately ? "Assigned" : "Draft",
      serviceDate: newServiceDate,
      assignedVehicleId: assignImmediately ? intakeVehicle?.id : undefined,
      assignedDriverId: assignImmediately ? intakeDriver?.id : undefined,
      onTimeDeparture: false,
      onTimeArrival: false,
      updatedAt: timestamp,
    };

    setMissions((previous) => [mission, ...previous]);
    setSelectedMissionId(id);

    setStatusEvents((previous) => [
      ...previous,
      {
        id: `status-${crypto.randomUUID()}`,
        missionId: id,
        toStatus: mission.status,
        timestamp,
      },
    ]);

    if (assignImmediately && intakeVehicle && intakeDriver) {
      setAssignmentEvents((previous) => [
        ...previous,
        {
          id: `assignment-${crypto.randomUUID()}`,
          missionId: id,
          vehicleLabel: intakeVehicle.label,
          driverLabel: intakeDriver.label,
          timestamp,
        },
      ]);
      setIntakeNotice(`Mission ${id} created and assigned in one flow.`);
    } else {
      setIntakeNotice(`Mission ${id} created as draft.`);
    }

    setNewRoute("");
    setNewPriority("Normal");
  };

  const handleAssignMission = (mission: Mission) => {
    if (!intakeAssignmentCheck.allowed || !intakeVehicle || !intakeDriver) {
      setIntakeError(intakeAssignmentCheck.reason ?? "Select active vehicle and driver.");
      return;
    }

    const timestamp = new Date().toISOString();
    const previousStatus = mission.status;
    updateMission(mission.id, (currentMission) => ({
      ...currentMission,
      status: "Assigned",
      assignedVehicleId: intakeVehicle.id,
      assignedDriverId: intakeDriver.id,
      updatedAt: timestamp,
    }));

    setAssignmentEvents((previous) => [
      ...previous,
      {
        id: `assignment-${crypto.randomUUID()}`,
        missionId: mission.id,
        vehicleLabel: intakeVehicle.label,
        driverLabel: intakeDriver.label,
        timestamp,
      },
    ]);

    if (previousStatus !== "Assigned") {
      setStatusEvents((previous) => [
        ...previous,
        {
          id: `status-${crypto.randomUUID()}`,
          missionId: mission.id,
          fromStatus: previousStatus,
          toStatus: "Assigned",
          timestamp,
        },
      ]);
    }

    setIntakeError("");
    setIntakeNotice(`Mission ${mission.id} updated with new assignment.`);
  };

  const handleLogException = () => {
    setExceptionError("");

    if (!selectedMission) {
      setExceptionError("Select a mission before logging an exception.");
      return;
    }

    if (!exceptionNote.trim()) {
      setExceptionError("Exception note is required.");
      return;
    }

    setExceptionEvents((previous) => [
      ...previous,
      {
        id: `exception-${crypto.randomUUID()}`,
        missionId: selectedMission.id,
        reason: exceptionReason,
        note: exceptionNote.trim(),
        timestamp: new Date().toISOString(),
      },
    ]);
    setExceptionNote("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mission Intake And Assignment</CardTitle>
          <CardDescription>
            Dispatchers can create draft missions or complete create + assign in one end-to-end flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="Route (Abidjan -> Yamoussoukro)"
              value={newRoute}
              onChange={(event) => setNewRoute(event.target.value)}
            />
            <Select value={newPriority} onValueChange={(value) => setNewPriority(value as Mission["priority"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Critical">Critical</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={newServiceDate}
              onChange={(event) => setNewServiceDate(event.target.value)}
            />
            <Select
              value={intakeVehicleId}
              onValueChange={(value) => setIntakeVehicleId(value ?? "")}
            >
              <SelectTrigger>
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
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Select
              value={intakeDriverId}
              onValueChange={(value) => setIntakeDriverId(value ?? "")}
            >
              <SelectTrigger>
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
            <Button variant="outline" onClick={() => handleCreateMission(false)}>
              Create Draft
            </Button>
            <Button onClick={() => handleCreateMission(true)}>Create + Assign</Button>
          </div>

          {!intakeAssignmentCheck.allowed ? (
            <Alert variant="destructive">{intakeAssignmentCheck.reason}</Alert>
          ) : null}
          {intakeError ? <Alert variant="destructive">{intakeError}</Alert> : null}
          {intakeNotice ? <Alert>{intakeNotice}</Alert> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mission Filters</CardTitle>
          <CardDescription>
            Search by date, route, driver, and vehicle to keep completed missions operationally retrievable.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input
            placeholder="Search route or city"
            value={filters.query}
            onChange={(event) => setFilters((previous) => ({ ...previous, query: event.target.value }))}
          />
          <Input
            type="date"
            value={filters.serviceDateFrom}
            onChange={(event) => setFilters((previous) => ({ ...previous, serviceDateFrom: event.target.value }))}
          />
          <Input
            type="date"
            value={filters.serviceDateTo}
            onChange={(event) => setFilters((previous) => ({ ...previous, serviceDateTo: event.target.value }))}
          />
          <Select
            value={filters.driverId}
            onValueChange={(value) =>
              setFilters((previous) => ({ ...previous, driverId: value ?? "all" }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All drivers</SelectItem>
              {driverOptions.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.vehicleId}
            onValueChange={(value) =>
              setFilters((previous) => ({ ...previous, vehicleId: value ?? "all" }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vehicles</SelectItem>
              {vehicleOptions.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Mission Queue</CardTitle>
            <CardDescription>
              Mission lifecycle transitions, assignment controls, and filtered operations list.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredMissions.length === 0 ? (
              <Alert>No missions match the active filter set.</Alert>
            ) : (
              filteredMissions.map((mission) => {
                const nextStatuses = getNextMissionStatuses(mission.status);
                return (
                  <div
                    key={mission.id}
                    className="space-y-3 rounded-md border border-border px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => setSelectedMissionId(mission.id)}
                      >
                        <p className="text-sm font-semibold text-foreground">{mission.id}</p>
                        <p className="text-sm text-muted-foreground">{mission.route}</p>
                        <p className="text-xs text-muted-foreground">
                          Service date: {mission.serviceDate ?? "Not set"}
                        </p>
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{mission.priority}</Badge>
                        <Badge className={missionStatusTone[mission.status]}>{mission.status}</Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {nextStatuses.map((nextStatus) => (
                        <Button
                          key={nextStatus}
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStatusTransition(mission, nextStatus)}
                        >
                          Move to {nextStatus}
                        </Button>
                      ))}
                      <Button size="sm" variant="outline" onClick={() => handleAssignMission(mission)}>
                        Assign Selected Assets
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mission Timeline</CardTitle>
              <CardDescription>
                Status, assignment, and exception history for the selected mission.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedMission ? (
                <>
                  <p className="text-sm font-medium text-foreground">
                    {selectedMission.id} - {selectedMission.route}
                  </p>
                  {selectedTimeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No timeline entries yet.</p>
                  ) : (
                    selectedTimeline.map((event) => (
                      <div key={event.id} className="rounded-md border border-border px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline">{event.kind}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-foreground">{event.title}</p>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </div>
                    ))
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a mission to view timeline events.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exception Log</CardTitle>
              <CardDescription>
                Capture reason code and notes for delay/breakdown/reroute/no-show events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={exceptionReason}
                onValueChange={(value) => setExceptionReason(value as MissionExceptionReason)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {exceptionReasonOptions.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {formatExceptionReason(reason)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Textarea
                placeholder="Operational note for this exception"
                value={exceptionNote}
                onChange={(event) => setExceptionNote(event.target.value)}
              />

              {exceptionError ? <Alert variant="destructive">{exceptionError}</Alert> : null}

              <Button className="w-full" onClick={handleLogException}>
                Log Exception
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
