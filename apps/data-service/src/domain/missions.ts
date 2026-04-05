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

export interface MissionExceptionEntry {
  id: string;
  missionId: string;
  type: MissionExceptionType;
  description: string;
  actorId: string;
  timestamp: string;
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
    createdAt: "2026-04-05T08:40:00.000Z",
    updatedAt: "2026-04-05T08:50:00.000Z",
  },
  {
    id: "M-2402",
    route: "Bouake -> Korhogo",
    priority: "Critical",
    status: "Draft",
    serviceDate: "2026-04-05",
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
  private readonly exceptionLog = new Map<string, MissionExceptionEntry[]>();

  constructor(initialMissions: Mission[] = seedMissions) {
    for (const mission of initialMissions) {
      this.missions.set(mission.id, { ...mission });
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
  }: {
    missionId: string;
    nextStatus: MissionStatus;
  }): Mission {
    const mission = this.getMissionOrThrow(missionId);

    const allowed = lifecycleMap[mission.status];
    if (!allowed.includes(nextStatus)) {
      throw new MissionDomainError(
        `Invalid transition from '${mission.status}' to '${nextStatus}'`,
        "invalid_transition",
      );
    }

    mission.status = nextStatus;
    mission.updatedAt = nowIso();
    this.missions.set(mission.id, mission);
    return mission;
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
    description,
    actorId,
  }: {
    missionId: string;
    type: MissionExceptionType;
    description: string;
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
}

let store: MissionStore | undefined;

export function getMissionStore() {
  if (!store) {
    store = new MissionStore();
  }

  return store;
}
