export type MissionStatus = "Draft" | "Assigned" | "In Transit" | "Completed" | "Cancelled";

export type MissionPriority = "Critical" | "High" | "Normal";

export type MissionExceptionType = "delay" | "breakdown" | "reroute" | "no_show";

export interface Mission {
  id: string;
  route: string;
  priority: MissionPriority;
  status: MissionStatus;
  serviceDate: string;
  assignedVehicleId?: string;
  assignedDriverId?: string;
  onTimeDeparture: boolean;
  onTimeArrival: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentHistoryEntry {
  id: string;
  missionId: string;
  vehicleId: string;
  driverId: string;
  actorId: string;
  timestamp: string;
}

export interface StatusHistoryEntry {
  id: string;
  missionId: string;
  fromStatus?: MissionStatus;
  toStatus: MissionStatus;
  actorId: string;
  timestamp: string;
}

export interface MissionExceptionEntry {
  id: string;
  missionId: string;
  type: MissionExceptionType;
  description: string;
  actorId: string;
  timestamp: string;
}

export interface MissionKpiSnapshot {
  completionRate: number;
  onTimeDepartureRate: number;
  onTimeArrivalRate: number;
  activeMissionCount: number;
  generatedAt: string;
}

export interface MissionKpiTrendPoint {
  date: string;
  totalMissions: number;
  completionRate: number;
  onTimeDepartureRate: number;
  onTimeArrivalRate: number;
}

export interface MissionKpiSummary {
  snapshot: MissionKpiSnapshot;
  trends: MissionKpiTrendPoint[];
  delayReasonMix: Record<MissionExceptionType, number>;
}

export interface MissionTimelineEvent {
  id: string;
  missionId: string;
  eventType: "status_changed" | "assignment_changed" | "exception_logged";
  actorId: string;
  timestamp: string;
  payload: Record<string, string>;
}

const lifecycleMap: Record<MissionStatus, MissionStatus[]> = {
  Draft: ["Assigned", "Cancelled"],
  Assigned: ["In Transit", "Cancelled"],
  "In Transit": ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

const seedMissions: Mission[] = [
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
    createdAt: "2026-04-05T08:40:00.000Z",
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
    createdAt: "2026-04-05T09:00:00.000Z",
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
    createdAt: "2026-04-05T10:00:00.000Z",
    updatedAt: "2026-04-05T10:05:00.000Z",
  },
];

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function percentage(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
}

function normalizeDate(date: string): string {
  return date.slice(0, 10);
}

function routeMatchesDepot(route: string, depot: string): boolean {
  const needle = depot.toLowerCase();
  const [fromRaw, toRaw] = route.split("->");
  const from = (fromRaw ?? "").trim().toLowerCase();
  const to = (toRaw ?? "").trim().toLowerCase();
  return from.includes(needle) || to.includes(needle);
}

export class MissionDomainError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "invalid_transition" | "invalid_request",
  ) {
    super(message);
    this.name = "MissionDomainError";
  }
}

export class MissionStore {
  private readonly missions = new Map<string, Mission>();
  private readonly assignmentHistory = new Map<string, AssignmentHistoryEntry[]>();
  private readonly statusHistory = new Map<string, StatusHistoryEntry[]>();
  private readonly exceptionLog = new Map<string, MissionExceptionEntry[]>();

  constructor(initialMissions: Mission[] = seedMissions) {
    for (const mission of initialMissions) {
      this.missions.set(mission.id, { ...mission });
      this.statusHistory.set(mission.id, [
        {
          id: randomId("st"),
          missionId: mission.id,
          toStatus: mission.status,
          actorId: "system",
          timestamp: mission.updatedAt,
        },
      ]);
    }
  }

  getMissionOrThrow(missionId: string): Mission {
    const mission = this.missions.get(missionId);

    if (!mission) {
      throw new MissionDomainError(`Mission '${missionId}' not found`, "not_found");
    }

    return mission;
  }

  listMissions(filters: {
    route?: string;
    driverId?: string;
    vehicleId?: string;
    serviceDateFrom?: string;
    serviceDateTo?: string;
  }): Mission[] {
    return Array.from(this.missions.values()).filter((mission) => {
      if (filters.route && !mission.route.toLowerCase().includes(filters.route.toLowerCase())) {
        return false;
      }

      if (filters.driverId && mission.assignedDriverId !== filters.driverId) {
        return false;
      }

      if (filters.vehicleId && mission.assignedVehicleId !== filters.vehicleId) {
        return false;
      }

      if (filters.serviceDateFrom && mission.serviceDate < filters.serviceDateFrom) {
        return false;
      }

      if (filters.serviceDateTo && mission.serviceDate > filters.serviceDateTo) {
        return false;
      }

      return true;
    });
  }

  updateStatus({
    missionId,
    nextStatus,
    actorId,
  }: {
    missionId: string;
    nextStatus: MissionStatus;
    actorId: string;
  }): Mission {
    const mission = this.getMissionOrThrow(missionId);
    const previousStatus = mission.status;

    const allowed = lifecycleMap[previousStatus];
    if (!allowed.includes(nextStatus)) {
      throw new MissionDomainError(
        `Invalid transition from '${previousStatus}' to '${nextStatus}'`,
        "invalid_transition",
      );
    }

    const timestamp = nowIso();
    mission.status = nextStatus;
    mission.updatedAt = timestamp;

    const currentHistory = this.statusHistory.get(missionId) ?? [];
    currentHistory.push({
      id: randomId("st"),
      missionId,
      fromStatus: previousStatus,
      toStatus: nextStatus,
      actorId,
      timestamp,
    });
    this.statusHistory.set(missionId, currentHistory);

    this.missions.set(mission.id, mission);
    return mission;
  }

  listStatusHistory(missionId: string): StatusHistoryEntry[] {
    this.getMissionOrThrow(missionId);
    return this.statusHistory.get(missionId) ?? [];
  }

  assignMission({
    missionId,
    vehicleId,
    driverId,
    actorId,
  }: {
    missionId: string;
    vehicleId: string;
    driverId: string;
    actorId: string;
  }): { mission: Mission; assignment: AssignmentHistoryEntry } {
    const mission = this.getMissionOrThrow(missionId);
    const timestamp = nowIso();

    mission.assignedVehicleId = vehicleId;
    mission.assignedDriverId = driverId;
    mission.updatedAt = timestamp;

    if (mission.status === "Draft") {
      mission.status = "Assigned";
    }

    if (mission.status !== "Assigned" && mission.status !== "In Transit") {
      throw new MissionDomainError(
        `Mission in status '${mission.status}' cannot be assigned`,
        "invalid_transition",
      );
    }

    const assignment: AssignmentHistoryEntry = {
      id: randomId("asn"),
      missionId,
      vehicleId,
      driverId,
      actorId,
      timestamp,
    };

    const currentHistory = this.assignmentHistory.get(missionId) ?? [];
    currentHistory.push(assignment);
    this.assignmentHistory.set(missionId, currentHistory);
    this.missions.set(missionId, mission);

    return { mission, assignment };
  }

  listAssignmentHistory(missionId: string): AssignmentHistoryEntry[] {
    this.getMissionOrThrow(missionId);
    return this.assignmentHistory.get(missionId) ?? [];
  }

  addException({
    missionId,
    type,
    description = "",
    actorId,
  }: {
    missionId: string;
    type: MissionExceptionType;
    description?: string;
    actorId: string;
  }): MissionExceptionEntry {
    this.getMissionOrThrow(missionId);
    const entry: MissionExceptionEntry = {
      id: randomId("exn"),
      missionId,
      type,
      description,
      actorId,
      timestamp: nowIso(),
    };

    const currentLog = this.exceptionLog.get(missionId) ?? [];
    currentLog.push(entry);
    this.exceptionLog.set(missionId, currentLog);
    return entry;
  }

  listExceptions(missionId: string): MissionExceptionEntry[] {
    this.getMissionOrThrow(missionId);
    return this.exceptionLog.get(missionId) ?? [];
  }

  getMissionTimeline(missionId: string): MissionTimelineEvent[] {
    this.getMissionOrThrow(missionId);

    const statusEvents = (this.statusHistory.get(missionId) ?? []).map((event) => ({
      id: event.id,
      missionId: event.missionId,
      eventType: "status_changed" as const,
      actorId: event.actorId,
      timestamp: event.timestamp,
      payload: {
        fromStatus: event.fromStatus ?? "",
        toStatus: event.toStatus,
      },
    }));

    const assignmentEvents = (this.assignmentHistory.get(missionId) ?? []).map((event) => ({
      id: event.id,
      missionId: event.missionId,
      eventType: "assignment_changed" as const,
      actorId: event.actorId,
      timestamp: event.timestamp,
      payload: {
        vehicleId: event.vehicleId,
        driverId: event.driverId,
      },
    }));

    const exceptionEvents = (this.exceptionLog.get(missionId) ?? []).map((event) => ({
      id: event.id,
      missionId: event.missionId,
      eventType: "exception_logged" as const,
      actorId: event.actorId,
      timestamp: event.timestamp,
      payload: {
        type: event.type,
        description: event.description,
      },
    }));

    return [...statusEvents, ...assignmentEvents, ...exceptionEvents].sort((a, b) =>
      a.timestamp > b.timestamp ? 1 : -1,
    );
  }

  summarizeKpis(filters: {
    from: string;
    to: string;
    route?: string;
    depot?: string;
  }): MissionKpiSummary {
    const missions = this.listMissions({
      route: filters.route,
      serviceDateFrom: filters.from,
      serviceDateTo: filters.to,
    }).filter((mission) =>
      filters.depot ? routeMatchesDepot(mission.route, filters.depot) : true,
    );

    const completed = missions.filter((mission) => mission.status === "Completed").length;
    const onTimeDeparture = missions.filter((mission) => mission.onTimeDeparture).length;
    const onTimeArrival = missions.filter((mission) => mission.onTimeArrival).length;
    const activeMissionCount = missions.filter(
      (mission) => mission.status === "Assigned" || mission.status === "In Transit",
    ).length;

    const trends: MissionKpiTrendPoint[] = [];
    let cursor = new Date(`${filters.from}T00:00:00.000Z`);
    const end = new Date(`${filters.to}T00:00:00.000Z`);
    while (cursor <= end) {
      const day = cursor.toISOString().slice(0, 10);
      const dayMissions = missions.filter((mission) => mission.serviceDate === day);
      trends.push({
        date: day,
        totalMissions: dayMissions.length,
        completionRate: percentage(
          dayMissions.filter((mission) => mission.status === "Completed").length,
          dayMissions.length,
        ),
        onTimeDepartureRate: percentage(
          dayMissions.filter((mission) => mission.onTimeDeparture).length,
          dayMissions.length,
        ),
        onTimeArrivalRate: percentage(
          dayMissions.filter((mission) => mission.onTimeArrival).length,
          dayMissions.length,
        ),
      });
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }

    const missionIds = new Set(missions.map((mission) => mission.id));
    const delayReasonMix: Record<MissionExceptionType, number> = {
      delay: 0,
      breakdown: 0,
      reroute: 0,
      no_show: 0,
    };

    for (const exceptions of this.exceptionLog.values()) {
      for (const exception of exceptions) {
        if (!missionIds.has(exception.missionId)) {
          continue;
        }

        const date = normalizeDate(exception.timestamp);
        if (date < filters.from || date > filters.to) {
          continue;
        }

        delayReasonMix[exception.type] += 1;
      }
    }

    return {
      snapshot: {
        completionRate: percentage(completed, missions.length),
        onTimeDepartureRate: percentage(onTimeDeparture, missions.length),
        onTimeArrivalRate: percentage(onTimeArrival, missions.length),
        activeMissionCount,
        generatedAt: nowIso(),
      },
      trends,
      delayReasonMix,
    };
  }
}

let store: MissionStore | undefined;

export function getMissionStore() {
  if (!store) {
    store = new MissionStore();
  }

  return store;
}
