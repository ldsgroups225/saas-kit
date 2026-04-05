import { describe, expect, it } from "vitest";
import type { PendingMissionUpdate } from "@/components/dashboard/mission-sync";
import {
  clearPendingMissionUpdates,
  createMissionUpdate,
  flushPendingMissionUpdates,
  getPendingMissionUpdates,
  queueMissionUpdate,
} from "@/components/dashboard/mission-sync";

describe("mission-sync", () => {
  it("queues mission updates for offline delivery", () => {
    clearPendingMissionUpdates();

    queueMissionUpdate(
      createMissionUpdate("mission-001", "status", {
        status: "arrived",
      }),
    );

    const pending = getPendingMissionUpdates();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.missionId).toBe("mission-001");
    expect(pending[0]?.kind).toBe("status");
  });

  it("flushes successful updates and keeps failed updates queued", async () => {
    clearPendingMissionUpdates();

    const updates: Array<PendingMissionUpdate> = [
      createMissionUpdate("mission-001", "status", { status: "arrived" }),
      createMissionUpdate("mission-002", "status", { status: "delivered" }),
    ];

    updates.forEach((update) => queueMissionUpdate(update));

    const result = await flushPendingMissionUpdates((update) => {
      if (update.missionId === "mission-002") {
        throw new Error("Temporary API failure");
      }

      return Promise.resolve();
    });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(getPendingMissionUpdates()).toHaveLength(1);
    expect(getPendingMissionUpdates()[0]?.missionId).toBe("mission-002");
  });
});
