import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { MissionStore } from "../domain/missions";

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("missions api", () => {
  it("returns KPI summary snapshot with trend points and delay reason mix", async () => {
    const app = createApp(new MissionStore());
    const response = await app.request(
      "/api/kpi/missions/summary?from=2026-03-07&to=2026-04-05",
    );

    expect(response.status).toBe(200);
    const body = await readJson<{
      snapshot: {
        completionRate: number;
        onTimeDepartureRate: number;
        onTimeArrivalRate: number;
        activeMissionCount: number;
        generatedAt: string;
      };
      delayReasonMix: Record<string, number>;
      trends: Array<{ date: string }>;
    }>(response);
    expect(body.snapshot).toBeDefined();
    expect(body.snapshot.activeMissionCount).toBeGreaterThanOrEqual(0);
    expect(new Date(body.snapshot.generatedAt).toString()).not.toBe("Invalid Date");
    expect(Object.keys(body.delayReasonMix).length).toBeGreaterThan(0);
    expect(body.trends.length).toBe(30);
  });

  it("returns filtered missions by route, driver, vehicle and date window", async () => {
    const app = createApp(new MissionStore());
    const response = await app.request(
      "/api/missions?route=abidjan&driverId=drv-ada&vehicleId=veh-101&serviceDateFrom=2026-04-05&serviceDateTo=2026-04-05",
    );

    expect(response.status).toBe(200);
    const body = await readJson<{ missions: Array<{ id: string }> }>(response);
    expect(body.missions).toHaveLength(1);
    const mission = body.missions[0];
    expect(mission).toBeDefined();
    expect(mission?.id).toBe("M-2401");
  });

  it("enforces lifecycle guardrails for invalid status transitions", async () => {
    const app = createApp(new MissionStore());
    const response = await app.request(
      "/api/missions/M-2402/status",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      },
    );

    expect(response.status).toBe(400);
    const body = await readJson<{ error: string }>(response);
    expect(body.error).toMatch(/invalid transition/i);
  });

  it("records assignment history with actor and timestamp", async () => {
    const app = createApp(new MissionStore());

    const assignmentResponse = await app.request(
      "/api/missions/M-2402/assignments",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: "veh-308",
          driverId: "drv-rose",
          actorId: "dispatcher-01",
        }),
      },
    );

    expect(assignmentResponse.status).toBe(201);
    const assignmentBody = await readJson<{ mission: { status: string } }>(assignmentResponse);
    expect(assignmentBody.mission.status).toBe("Assigned");

    const historyResponse = await app.request("/api/missions/M-2402/assignment-history");
    expect(historyResponse.status).toBe(200);
    const historyBody = await readJson<{
      history: Array<{
        vehicleId: string;
        driverId: string;
        actorId: string;
        timestamp: string;
      }>;
    }>(historyResponse);
    expect(historyBody.history).toHaveLength(1);
    const historyEntry = historyBody.history[0];
    expect(historyEntry).toBeDefined();
    expect(historyEntry?.vehicleId).toBe("veh-308");
    expect(historyEntry?.driverId).toBe("drv-rose");
    expect(historyEntry?.actorId).toBe("dispatcher-01");
    expect(new Date(historyEntry?.timestamp ?? "").toString()).not.toBe("Invalid Date");
  });

  it("captures mission exceptions and returns them for timeline consumption", async () => {
    const app = createApp(new MissionStore());

    const postResponse = await app.request(
      "/api/missions/M-2403/exceptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "delay",
          description: "Bridge traffic slowdown +35min",
          actorId: "ops-lead-02",
        }),
      },
    );

    expect(postResponse.status).toBe(201);

    const listResponse = await app.request("/api/missions/M-2403/exceptions");
    expect(listResponse.status).toBe(200);
    const listBody = await readJson<{
      exceptions: Array<{ type: string; description: string; actorId: string }>;
    }>(listResponse);
    expect(listBody.exceptions).toHaveLength(1);
    const exceptionEntry = listBody.exceptions[0];
    expect(exceptionEntry).toBeDefined();
    expect(exceptionEntry?.type).toBe("delay");
    expect(exceptionEntry?.description).toContain("35min");
    expect(exceptionEntry?.actorId).toBe("ops-lead-02");
  });
});
