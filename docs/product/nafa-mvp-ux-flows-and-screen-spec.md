# Nafa MVP UX Flows and Screen Spec (M0-M1)

## Scope and Source
- Source scope: [NAF-14](/NAF/issues/NAF-14)
- Engineering planning anchor: [NAF-22](/NAF/issues/NAF-22)
- Delivery target: M0 and M1 only
- Out of scope: route optimization, billing automation, predictive maintenance, advanced permissions

## Personas and Primary Jobs
- Dispatcher: create, assign, monitor, and close missions quickly
- Fleet Manager: maintain driver and vehicle readiness and enforce availability
- Operations Lead: monitor KPIs, spot exceptions, and track operational health

## Global UX Rules
- Mission states are explicit and immutable in history: `Draft -> Assigned -> In Transit -> Completed/Cancelled`.
- Every state change writes an event with actor and timestamp.
- Unavailable assets cannot be assigned to new missions.
- Exceptions require a reason code and allow free-text notes.
- Key actions return clear inline feedback in under 5 seconds (success, warning, or blocking error).

## Information Architecture
- Dashboard
- Missions
  - Mission list
  - Mission intake (create/edit)
  - Mission detail and timeline
- Assignment
  - Assignment modal/panel
  - Reassignment flow
- Fleet
  - Vehicles registry
  - Drivers registry
  - Availability and compliance reminders
- KPI
  - KPI summary cards
  - Trend views
  - Delay reason distribution

## End-to-End Flows

### 1) Dispatcher: Mission Intake to Completion
1. Open `Missions` and click `New Mission`.
2. Fill required intake fields (origin, destination, load/passenger, time window, priority).
3. Save as `Draft` or continue to assignment.
4. Open assignment panel and select available vehicle and driver.
5. Confirm assignment; mission status changes to `Assigned`.
6. Dispatcher or operator updates status to `In Transit` at departure.
7. Log exceptions if needed (delay, breakdown, reroute, no-show).
8. Mark mission `Completed` or `Cancelled`.
9. Timeline shows full event audit trail.

Success criteria:
- Dispatcher can create and assign within one continuous flow in <= 2 minutes.
- Status changes appear in mission list and dashboard in <= 5 seconds.

### 2) Fleet Manager: Asset Readiness and Availability
1. Open `Fleet` and review vehicle/driver records.
2. Add or update vehicle and driver metadata.
3. Mark asset as `active`, `maintenance`, or `inactive`.
4. Set compliance/maintenance reminder dates.
5. When asset is unavailable, assignment flow blocks selection and explains why.

Success criteria:
- Fleet manager can prevent assignment to unavailable assets.
- Dispatcher sees availability state at assignment time.

### 3) Operations Lead: KPI Monitoring and Exception Oversight
1. Open `Dashboard`.
2. Review mission completion, on-time departure/arrival, utilization, and delay distribution.
3. Filter by date and operational segment.
4. Drill into delayed missions and inspect logged exceptions.
5. Open mission details for corrective follow-up.

Success criteria:
- Operations lead can identify trend shifts and exception clusters without leaving dashboard context.

## Screen Specifications

### A. Mission List Screen
Purpose:
- Operational queue for all missions

Core UI:
- Table/list with mission id, route, schedule window, priority, status, assigned driver/vehicle, last update
- Filter bar: status, date, route/depot, driver, vehicle
- Actions: `New Mission`, open mission detail, quick status update

States:
- Empty state with CTA to create mission
- Loading/skeleton state
- Error state with retry

### B. Mission Intake Screen
Purpose:
- Fast and validated mission creation/edit

Core UI:
- Required fields grouped by trip basics, timing, and priority
- Save actions: `Save Draft`, `Save and Assign`
- Inline validation and field-level errors

Validation behavior:
- Missing required fields block submit
- Invalid time windows show blocking error with corrective guidance

### C. Assignment Panel/Modal
Purpose:
- Pair mission with available vehicle and driver

Core UI:
- Availability-aware selectors for vehicle and driver
- Capacity/readiness indicators
- Confirmation summary before submit

Validation behavior:
- Block assignment if selected asset becomes unavailable
- Show actionable reason (maintenance/inactive/compliance)

### D. Mission Detail and Timeline
Purpose:
- Single source of truth for mission lifecycle and execution

Core UI:
- Header: mission identity, current status, assignees
- Timeline: assignment, departure, in-transit updates, completion/cancellation
- Exception log panel with reason code and notes
- Actions: update status, log exception, reassign

### E. Fleet Master Data (Vehicles/Drivers)
Purpose:
- Manage readiness and constraints

Core UI:
- Vehicles tab and Drivers tab
- CRUD forms and status controls
- Reminder indicators for upcoming compliance and maintenance dates

Validation behavior:
- Required profile fields block save
- Availability status changes immediately reflected in assignment UI

### F. KPI Dashboard
Purpose:
- Operational health and trend visibility

Core UI:
- KPI cards: completion rate, on-time departure, on-time arrival, utilization
- Trend charts (last 30 days default)
- Delay reason distribution chart
- Filter controls and quick drill-through to mission lists

## Edge Cases and UX Handling
- Asset becomes unavailable during assignment:
  - Block confirm, preserve draft inputs, show reason and replacement suggestion flow
- Delay/exception logging missing reason code:
  - Block save until reason selected; notes optional but encouraged
- Reassignment after mission start:
  - Require confirmation modal, write explicit timeline event for reassignment
- Concurrent mission updates:
  - Detect stale state, prompt user to refresh and reapply action
- Connectivity/API failure:
  - Non-destructive retries with clear status banner and preserved form state

## Interaction Notes for Engineering
- Status transition controls must enforce valid next states only.
- Timeline ordering uses server timestamps and actor identity from auth context.
- Filters and list pagination should preserve query state across navigation.
- Success/error toasts should be paired with inline context for actionable recovery.

## Handoff Mapping to Engineering Tickets
- Planning and decomposition parent: [NAF-22](/NAF/issues/NAF-22)
- Backend contracts and lifecycle/event model: [NAF-17](/NAF/issues/NAF-17)
- Web operator UI implementation: [NAF-18](/NAF/issues/NAF-18)
- Mobile execution parity considerations: [NAF-19](/NAF/issues/NAF-19)
- QA validation and release gate checks: [NAF-20](/NAF/issues/NAF-20)

Note:
- When [NAF-22](/NAF/issues/NAF-22) publishes child implementation tickets, map each screen and flow section above to those ticket IDs as the final handoff index.

## Acceptance Checklist (M0-M1)
- Mission intake and assignment flow is complete and unambiguous
- Lifecycle and timeline interactions are fully specified
- Fleet availability constraints are explicit
- KPI dashboard requirements are explicit for implementation and test
- Edge-case handling is defined for unavailable assets, delays/exceptions, and reassignment
