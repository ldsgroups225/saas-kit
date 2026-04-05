# Nafa M0 Backend API Contracts and Schema Checkpoints

## Scope
- Source issue: [NAF-26](/NAF/issues/NAF-26)
- Parent planning issue: [NAF-22](/NAF/issues/NAF-22)
- Execution issue: [NAF-17](/NAF/issues/NAF-17)
- Product scope source: [NAF-14](/NAF/issues/NAF-14)

This document freezes the M0 contract surface for fleet, mission lifecycle, assignment history, exception logging, and KPI event aggregation.

## Contract Principles
- Mission lifecycle is strictly `Draft -> Assigned -> In Transit -> Completed | Cancelled`.
- Every status transition, assignment change, and exception must be represented as a timestamped event.
- Assignment to unavailable assets is rejected with actionable errors.
- KPI views are aggregates over immutable mission event facts.

## Core Types

```ts
export type MissionStatus = "Draft" | "Assigned" | "In Transit" | "Completed" | "Cancelled";
export type MissionPriority = "Critical" | "High" | "Normal";
export type MissionExceptionType = "delay" | "breakdown" | "reroute" | "no_show";
export type FleetAssetStatus = "active" | "maintenance" | "inactive";

export interface Mission {
  id: string;
  route: string;
  priority: MissionPriority;
  status: MissionStatus;
  serviceDate: string; // YYYY-MM-DD
  assignedVehicleId?: string;
  assignedDriverId?: string;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

export interface AssignmentHistoryEntry {
  id: string;
  missionId: string;
  vehicleId: string;
  driverId: string;
  actorId: string;
  timestamp: string; // ISO-8601
}

export interface MissionExceptionEntry {
  id: string;
  missionId: string;
  type: MissionExceptionType;
  description: string;
  actorId: string;
  timestamp: string; // ISO-8601
}

export interface FleetAsset {
  id: string;
  kind: "vehicle" | "driver";
  label: string;
  status: FleetAssetStatus;
  reason?: string;
  updatedAt: string; // ISO-8601
}
```

## HTTP Contract (M0)

### Health
- `GET /`
- Response `200`

```json
{ "service": "nafa-data-service", "status": "ok" }
```

### Missions
- `GET /api/missions`
- Query filters:
  - `status?: MissionStatus`
  - `route?: string`
  - `driverId?: string`
  - `vehicleId?: string`
  - `serviceDateFrom?: string` (`YYYY-MM-DD`)
  - `serviceDateTo?: string` (`YYYY-MM-DD`)
- Response `200`

```json
{ "missions": [Mission] }
```

- `GET /api/missions/:missionId`
- Response `200`

```json
{ "mission": Mission }
```

- `PATCH /api/missions/:missionId/status`
- Request body

```json
{ "status": "Assigned" }
```

- Response `200`

```json
{ "mission": Mission }
```

- Error cases
  - `400` invalid payload
  - `400` invalid lifecycle transition
  - `404` mission not found

### Assignments
- `POST /api/missions/:missionId/assignments`
- Request body

```json
{ "vehicleId": "veh-308", "driverId": "drv-rose", "actorId": "dispatcher-01" }
```

- Response `201`

```json
{ "mission": Mission, "assignment": AssignmentHistoryEntry }
```

- `GET /api/missions/:missionId/assignment-history`
- Response `200`

```json
{ "history": [AssignmentHistoryEntry] }
```

### Exceptions
- `POST /api/missions/:missionId/exceptions`
- Request body

```json
{ "type": "delay", "description": "Bridge traffic slowdown +35min", "actorId": "ops-lead-02" }
```

- Response `201`

```json
{ "exception": MissionExceptionEntry }
```

- `GET /api/missions/:missionId/exceptions`
- Response `200`

```json
{ "exceptions": [MissionExceptionEntry] }
```

### Fleet Master Data (Contract Freeze for NAF-17 implementation)
- `GET /api/fleet/assets`
- Query filters:
  - `kind?: "vehicle" | "driver"`
  - `status?: FleetAssetStatus`
- Response `200`

```json
{ "assets": [FleetAsset] }
```

### KPI Events and Aggregates (Contract Freeze for NAF-17 implementation)

```ts
export interface MissionKpiEvent {
  id: string;
  missionId: string;
  eventType: "status_changed" | "assignment_changed" | "exception_logged";
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface MissionKpiSnapshot {
  completionRate: number; // 0..100
  onTimeDepartureRate: number; // 0..100
  onTimeArrivalRate: number; // 0..100
  activeMissionCount: number;
  generatedAt: string; // ISO-8601
}
```

- `GET /api/kpi/missions/summary`
- Query filters:
  - `from: string` (`YYYY-MM-DD`)
  - `to: string` (`YYYY-MM-DD`)
- Response `200`

```json
{
  "snapshot": {
    "completionRate": 73,
    "onTimeDepartureRate": 81,
    "onTimeArrivalRate": 76,
    "activeMissionCount": 12,
    "generatedAt": "2026-04-05T21:00:00.000Z"
  }
}
```

## Validation and Error Contract
- Validation errors use:

```json
{ "error": "Human-readable message" }
```

- Status mapping:
  - `400` invalid payload or invalid transition
  - `404` not found
  - `500` unexpected server failure

## M0 Schema Checkpoints (Frozen)
- `mission_status_v1`: `Draft | Assigned | In Transit | Completed | Cancelled`
- `mission_priority_v1`: `Critical | High | Normal`
- `mission_exception_type_v1`: `delay | breakdown | reroute | no_show`
- `mission_entity_v1`: id/route/priority/status/serviceDate/assignees/timestamps
- `assignment_history_entry_v1`: assignment actor+timestamp event
- `mission_exception_entry_v1`: exception reason+description+actor+timestamp
- `fleet_asset_v1`: shared vehicle/driver availability contract
- `mission_kpi_event_v1`: append-only event envelope for KPI derivation
- `mission_kpi_snapshot_v1`: completion/on-time/utilization summary projection

## Notes
- Mission endpoints in `apps/data-service/src/hono/app.ts` are implemented and tested.
- Fleet and KPI routes are frozen as contract targets for implementation under [NAF-17](/NAF/issues/NAF-17).
