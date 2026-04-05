# Mobile Offline Sync Notes (Alpha)

## Scope

- Mission list and mission selection for field operators.
- Status transitions from the field UI (`scheduled` -> `in_transit` -> `delivered`).
- Proof-of-delivery capture baseline (`recipientName`, `deliveryNote`).
- Local queue for updates created while offline.

## Sync Behavior

- Offline writes are serialized to local storage key: `naf.field.pending-mission-updates`.
- Each pending item includes:
  - `id`
  - `missionId`
  - `kind` (`status` or `proof`)
  - `payload`
  - `createdAt`
- Manual sync action attempts to replay pending items in FIFO order.
- Failed sends remain in queue; successful sends are removed.

## Edge Cases + Handling Plan

- Invalid local storage content:
  - Fallback to empty queue (safe parse with guardrails).
- Partial sync failure:
  - Keep unsent items and report `sent/failed` counts to operator.
- Offline submission during proof capture:
  - Queue the proof payload and surface explicit "queued" message.
- Required proof fields missing:
  - Block save until `recipientName` is provided.
- Browser environments without usable `localStorage` API shape:
  - Fall back to an in-memory adapter to avoid runtime crashes.

## Next Iterations

- Attach camera/photo payload support and signature capture.
- Add background auto-sync on network reconnect.
- Replace placeholder send path with API contract integration + retry backoff.
- Add conflict resolution strategy for out-of-order status transitions.
