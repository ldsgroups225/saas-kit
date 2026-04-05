import { describe, expect, it } from "vitest";
import {
  buildMissionTimeline,
  canAssignMission,
  filterMissions,
  formatExceptionReason,
  getNextMissionStatuses,
  summarizeMissionKpis,
} from "./nafa-operations";
import type { FleetAsset, Mission, MissionTimelineInput } from "./nafa-operations";

describe("nafa operations contracts", () => {
  it("enforces mission lifecycle transitions", () => {
    expect(getNextMissionStatuses("Draft")).toEqual(["Assigned", "Cancelled"]);
    expect(getNextMissionStatuses("Assigned")).toEqual(["In Transit", "Cancelled"]);
    expect(getNextMissionStatuses("In Transit")).toEqual(["Completed", "Cancelled"]);
    expect(getNextMissionStatuses("Completed")).toEqual([]);
  });

  it("blocks assignment when vehicle or driver is unavailable", () => {
    const vehicle: FleetAsset = {
      id: "veh-01",
      label: "Truck 01",
      kind: "vehicle",
      status: "maintenance",
      reason: "Inspection",
    };

    const driver: FleetAsset = {
      id: "drv-01",
      label: "Ada",
      kind: "driver",
      status: "active",
    };

    const unavailableResult = canAssignMission({ vehicle, driver });
    expect(unavailableResult.allowed).toBe(false);
    expect(unavailableResult.reason).toMatch(/vehicle/i);

    const availableResult = canAssignMission({
      vehicle: { ...vehicle, status: "active", reason: undefined },
      driver,
    });

    expect(availableResult.allowed).toBe(true);
  });

  it("aggregates dashboard KPIs from missions", () => {
    const missions: Array<Mission> = [
      {
        id: "m-1",
        route: "Abidjan -> Yamoussoukro",
        priority: "High",
        status: "Completed",
        assignedVehicleId: "veh-1",
        assignedDriverId: "drv-1",
        onTimeDeparture: true,
        onTimeArrival: true,
        updatedAt: "2026-04-05T09:00:00.000Z",
      },
      {
        id: "m-2",
        route: "Bouake -> Korhogo",
        priority: "Normal",
        status: "In Transit",
        assignedVehicleId: "veh-2",
        assignedDriverId: "drv-2",
        onTimeDeparture: false,
        onTimeArrival: false,
        updatedAt: "2026-04-05T10:00:00.000Z",
      },
    ];

    const kpis = summarizeMissionKpis(missions);

    expect(kpis.completionRate).toBe(50);
    expect(kpis.onTimeDepartureRate).toBe(50);
    expect(kpis.onTimeArrivalRate).toBe(50);
    expect(kpis.activeMissionCount).toBe(1);
  });

  it("filters missions by route, date, driver, and vehicle", () => {
    const missions: Array<Mission> = [
      {
        id: "m-1",
        route: "Abidjan -> Yamoussoukro",
        priority: "High",
        status: "Assigned",
        assignedVehicleId: "veh-1",
        assignedDriverId: "drv-1",
        serviceDate: "2026-04-05",
        onTimeDeparture: true,
        onTimeArrival: false,
        updatedAt: "2026-04-05T09:00:00.000Z",
      },
      {
        id: "m-2",
        route: "Bouake -> Korhogo",
        priority: "Normal",
        status: "Completed",
        assignedVehicleId: "veh-2",
        assignedDriverId: "drv-2",
        serviceDate: "2026-04-04",
        onTimeDeparture: false,
        onTimeArrival: false,
        updatedAt: "2026-04-05T10:00:00.000Z",
      },
    ];

    const filtered = filterMissions(missions, {
      query: "abidjan",
      serviceDateFrom: "2026-04-05",
      serviceDateTo: "2026-04-05",
      driverId: "drv-1",
      vehicleId: "veh-1",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("m-1");
  });

  it("builds a descending mission timeline from status, assignment, and exception events", () => {
    const input: MissionTimelineInput = {
      missionId: "m-1",
      statusEvents: [
        {
          id: "st-1",
          missionId: "m-1",
          fromStatus: "Draft",
          toStatus: "Assigned",
          timestamp: "2026-04-05T08:10:00.000Z",
        },
      ],
      assignmentEvents: [
        {
          id: "as-1",
          missionId: "m-1",
          vehicleLabel: "Truck 101",
          driverLabel: "Ada",
          timestamp: "2026-04-05T08:15:00.000Z",
        },
      ],
      exceptionEvents: [
        {
          id: "ex-1",
          missionId: "m-1",
          reason: "delay",
          note: "Traffic at toll gate",
          timestamp: "2026-04-05T08:20:00.000Z",
        },
      ],
    };

    const timeline = buildMissionTimeline(input);

    expect(timeline.map((item) => item.kind)).toEqual(["exception", "assignment", "status"]);
    expect(timeline[0]?.title).toBe("Delay reported");
    expect(timeline[1]?.description).toMatch(/truck 101/i);
    expect(timeline[2]?.description).toMatch(/draft.*assigned/i);
  });

  it("formats exception reason labels for dispatcher UI", () => {
    expect(formatExceptionReason("delay")).toBe("Delay");
    expect(formatExceptionReason("breakdown")).toBe("Breakdown");
    expect(formatExceptionReason("reroute")).toBe("Reroute");
    expect(formatExceptionReason("no_show")).toBe("No Show");
  });
});
