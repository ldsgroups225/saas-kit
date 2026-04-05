export type MissionStatus =
  | "Draft"
  | "Assigned"
  | "In Transit"
  | "Completed"
  | "Cancelled";

export type MissionPriority = "Critical" | "High" | "Normal";

export type FleetStatus = "active" | "maintenance" | "inactive";

export interface FleetAsset {
  id: string;
  label: string;
  kind: "vehicle" | "driver";
  status: FleetStatus;
  reason?: string;
}

export interface Mission {
  id: string;
  route: string;
  priority: MissionPriority;
  status: MissionStatus;
  serviceDate?: string;
  assignedVehicleId?: string;
  assignedDriverId?: string;
  onTimeDeparture: boolean;
  onTimeArrival: boolean;
  updatedAt: string;
}

export type MissionExceptionReason = "delay" | "breakdown" | "reroute" | "no_show";

export interface MissionFilterInput {
  query?: string;
  route?: string;
  driverId?: string;
  vehicleId?: string;
  serviceDateFrom?: string;
  serviceDateTo?: string;
}

export interface MissionStatusEvent {
  id: string;
  missionId: string;
  fromStatus?: MissionStatus;
  toStatus: MissionStatus;
  timestamp: string;
}

export interface MissionAssignmentEvent {
  id: string;
  missionId: string;
  vehicleLabel: string;
  driverLabel: string;
  timestamp: string;
}

export interface MissionExceptionEvent {
  id: string;
  missionId: string;
  reason: MissionExceptionReason;
  note: string;
  timestamp: string;
}

export interface MissionTimelineInput {
  missionId: string;
  statusEvents: Array<MissionStatusEvent>;
  assignmentEvents: Array<MissionAssignmentEvent>;
  exceptionEvents: Array<MissionExceptionEvent>;
}

export interface MissionTimelineItem {
  id: string;
  kind: "status" | "assignment" | "exception";
  timestamp: string;
  title: string;
  description: string;
}

export interface MissionKpiTrendPoint {
  date: string;
  totalMissions: number;
  completionRate: number;
  onTimeDepartureRate: number;
  onTimeArrivalRate: number;
}

export interface AssignmentCheckResult {
  allowed: boolean;
  reason?: string;
}

const lifecycleMap: Record<MissionStatus, Array<MissionStatus>> = {
  Draft: ["Assigned", "Cancelled"],
  Assigned: ["In Transit", "Cancelled"],
  "In Transit": ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

export function getNextMissionStatuses(current: MissionStatus): Array<MissionStatus> {
  return lifecycleMap[current];
}

export function canAssignMission({
  vehicle,
  driver,
}: {
  vehicle?: FleetAsset;
  driver?: FleetAsset;
}): AssignmentCheckResult {
  if (!vehicle || !driver) {
    return {
      allowed: false,
      reason: "Vehicle and driver are both required before assignment.",
    };
  }

  if (vehicle.status !== "active") {
    return {
      allowed: false,
      reason: `Selected vehicle is unavailable (${vehicle.status}).`,
    };
  }

  if (driver.status !== "active") {
    return {
      allowed: false,
      reason: `Selected driver is unavailable (${driver.status}).`,
    };
  }

  return { allowed: true };
}

function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
}

export function summarizeMissionKpis(missions: Array<Mission>) {
  const total = missions.length;
  const completed = missions.filter((mission) => mission.status === "Completed").length;
  const onTimeDeparture = missions.filter((mission) => mission.onTimeDeparture).length;
  const onTimeArrival = missions.filter((mission) => mission.onTimeArrival).length;
  const activeMissionCount = missions.filter((mission) =>
    mission.status === "Assigned" || mission.status === "In Transit"
  ).length;

  return {
    completionRate: percentage(completed, total),
    onTimeDepartureRate: percentage(onTimeDeparture, total),
    onTimeArrivalRate: percentage(onTimeArrival, total),
    activeMissionCount,
  };
}

export function filterMissions(missions: Array<Mission>, filters: MissionFilterInput): Array<Mission> {
  const routeQuery = (filters.route || filters.query || "").trim().toLowerCase();

  return missions.filter((mission) => {
    if (routeQuery && !mission.route.toLowerCase().includes(routeQuery)) {
      return false;
    }

    if (filters.driverId && mission.assignedDriverId !== filters.driverId) {
      return false;
    }

    if (filters.vehicleId && mission.assignedVehicleId !== filters.vehicleId) {
      return false;
    }

    if (filters.serviceDateFrom && (!mission.serviceDate || mission.serviceDate < filters.serviceDateFrom)) {
      return false;
    }

    if (filters.serviceDateTo && (!mission.serviceDate || mission.serviceDate > filters.serviceDateTo)) {
      return false;
    }

    return true;
  });
}

export function formatExceptionReason(reason: MissionExceptionReason): string {
  const labelMap: Record<MissionExceptionReason, string> = {
    delay: "Delay",
    breakdown: "Breakdown",
    reroute: "Reroute",
    no_show: "No Show",
  };

  return labelMap[reason];
}

export function buildMissionTimeline(input: MissionTimelineInput): Array<MissionTimelineItem> {
  const statusItems: Array<MissionTimelineItem> = input.statusEvents
    .filter((event) => event.missionId === input.missionId)
    .map((event) => ({
      id: event.id,
      kind: "status",
      timestamp: event.timestamp,
      title: "Status updated",
      description: event.fromStatus
        ? `${event.fromStatus} -> ${event.toStatus}`
        : `Status set to ${event.toStatus}`,
    }));

  const assignmentItems: Array<MissionTimelineItem> = input.assignmentEvents
    .filter((event) => event.missionId === input.missionId)
    .map((event) => ({
      id: event.id,
      kind: "assignment",
      timestamp: event.timestamp,
      title: "Assignment updated",
      description: `${event.vehicleLabel} + ${event.driverLabel}`,
    }));

  const exceptionItems: Array<MissionTimelineItem> = input.exceptionEvents
    .filter((event) => event.missionId === input.missionId)
    .map((event) => ({
      id: event.id,
      kind: "exception",
      timestamp: event.timestamp,
      title: `${formatExceptionReason(event.reason)} reported`,
      description: event.note,
    }));

  return [...statusItems, ...assignmentItems, ...exceptionItems].sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function buildThirtyDayKpiTrend(
  missions: Array<Mission>,
  endDate: string = new Date().toISOString().slice(0, 10),
): Array<MissionKpiTrendPoint> {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const start = addDays(end, -29);
  const trend: Array<MissionKpiTrendPoint> = [];

  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const date = cursor.toISOString().slice(0, 10);
    const dayMissions = missions.filter((mission) => mission.serviceDate === date);
    const total = dayMissions.length;
    const completed = dayMissions.filter((mission) => mission.status === "Completed").length;
    const onTimeDeparture = dayMissions.filter((mission) => mission.onTimeDeparture).length;
    const onTimeArrival = dayMissions.filter((mission) => mission.onTimeArrival).length;

    trend.push({
      date,
      totalMissions: total,
      completionRate: percentage(completed, total),
      onTimeDepartureRate: percentage(onTimeDeparture, total),
      onTimeArrivalRate: percentage(onTimeArrival, total),
    });
  }

  return trend;
}

export function summarizeDelayReasonMix(
  exceptions: Array<MissionExceptionEvent>,
): Record<MissionExceptionReason, number> {
  const mix: Record<MissionExceptionReason, number> = {
    delay: 0,
    breakdown: 0,
    reroute: 0,
    no_show: 0,
  };

  for (const exception of exceptions) {
    mix[exception.reason] += 1;
  }

  return mix;
}

export const fleetAssetsSeed: Array<FleetAsset> = [
  {
    id: "veh-101",
    label: "Truck 101",
    kind: "vehicle",
    status: "active",
  },
  {
    id: "veh-204",
    label: "Van 204",
    kind: "vehicle",
    status: "maintenance",
    reason: "Brake inspection due",
  },
  {
    id: "veh-308",
    label: "Bus 308",
    kind: "vehicle",
    status: "active",
  },
  {
    id: "drv-ada",
    label: "Ada B.",
    kind: "driver",
    status: "active",
  },
  {
    id: "drv-kouame",
    label: "Kouame Y.",
    kind: "driver",
    status: "inactive",
    reason: "License renewal pending",
  },
  {
    id: "drv-rose",
    label: "Rose K.",
    kind: "driver",
    status: "active",
  },
];

export const missionsSeed: Array<Mission> = [
  {
    id: "M-2401",
    route: "Abidjan -> Yamoussoukro",
    priority: "High",
    status: "Assigned",
    serviceDate: "2026-04-05",
    assignedVehicleId: "veh-101",
    assignedDriverId: "drv-ada",
    onTimeDeparture: true,
    onTimeArrival: false,
    updatedAt: "2026-04-05T08:50:00.000Z",
  },
  {
    id: "M-2402",
    route: "Bouake -> Korhogo",
    priority: "Critical",
    status: "Draft",
    serviceDate: "2026-04-05",
    onTimeDeparture: false,
    onTimeArrival: false,
    updatedAt: "2026-04-05T09:10:00.000Z",
  },
  {
    id: "M-2403",
    route: "San Pedro -> Abidjan",
    priority: "Normal",
    status: "In Transit",
    serviceDate: "2026-04-05",
    assignedVehicleId: "veh-308",
    assignedDriverId: "drv-rose",
    onTimeDeparture: true,
    onTimeArrival: true,
    updatedAt: "2026-04-05T10:05:00.000Z",
  },
  {
    id: "M-2398",
    route: "Abidjan -> Daloa",
    priority: "Normal",
    status: "Completed",
    serviceDate: "2026-04-04",
    assignedVehicleId: "veh-101",
    assignedDriverId: "drv-ada",
    onTimeDeparture: true,
    onTimeArrival: true,
    updatedAt: "2026-04-04T15:24:00.000Z",
  },
];
