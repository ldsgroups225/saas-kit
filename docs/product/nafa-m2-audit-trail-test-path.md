# Nafa M2 Audit Trail Test Path

This runbook captures the API validation sequence for mission lifecycle audit trail and exception logging required by `NAF-31`.

## Preconditions
- Run data-service locally.
- Use an existing mission id that can transition from `Draft` (examples below use `M-2402`).

## API Verification Sequence
1. Move mission from `Draft` to `Assigned`:
   - `PATCH /api/missions/M-2402/status`
   - Body: `{ "status": "Assigned", "actorId": "dispatcher-01" }`
2. Move mission from `Assigned` to `In Transit`:
   - `PATCH /api/missions/M-2402/status`
   - Body: `{ "status": "In Transit", "actorId": "dispatcher-01" }`
3. Log an exception with reason code and optional note:
   - `POST /api/missions/M-2402/exceptions`
   - Body: `{ "type": "delay", "actorId": "ops-lead-02", "description": "Bridge traffic slowdown +35min" }`
4. Retrieve append-only status audit entries:
   - `GET /api/missions/M-2402/status-history`
5. Retrieve full mission timeline:
   - `GET /api/missions/M-2402/timeline`

## Expected Evidence
- `status-history` shows immutable chronological status events with `fromStatus`, `toStatus`, `actorId`, and `timestamp`.
- `timeline` includes:
  - `status_changed` events for each lifecycle step,
  - `exception_logged` events including reason (`type`) and description note,
  - mission-scoped events only for the requested mission id.
- Exception notes are optional; reason code is required.

## UI Validation Notes
- In the missions screen, timeline should reflect:
  - lifecycle updates (`Draft -> Assigned -> In Transit -> Completed/Cancelled`),
  - assignment updates,
  - exception entries with reason label and note.
- QA can correlate timeline entries by `missionId`, `actorId`, and timestamp ordering against API responses.
