import { Hono } from "hono";
import { z } from "zod";
import {
  MissionDomainError,
  MissionStore,
  type MissionStatus,
  getMissionStore,
} from "../domain/missions";

export function createApp(missionStore?: MissionStore) {
  const resolvedMissionStore = missionStore ?? getMissionStore();
  const app = new Hono<{ Bindings: Env }>();

const missionStatusSchema = z.enum([
  "Draft",
  "Assigned",
  "In Transit",
  "Completed",
  "Cancelled",
]);

const missionFilterSchema = z.object({
  route: z.string().optional(),
  depot: z.string().optional(),
  driverId: z.string().optional(),
  vehicleId: z.string().optional(),
  serviceDateFrom: z.string().optional(),
  serviceDateTo: z.string().optional(),
});

const missionKpiSummaryFilterSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  route: z.string().optional(),
  depot: z.string().optional(),
});

const missionStatusUpdateSchema = z.object({
  status: missionStatusSchema,
  actorId: z.string().min(1),
});

const missionAssignmentSchema = z.object({
  vehicleId: z.string().min(1),
  driverId: z.string().min(1),
  actorId: z.string().min(1),
});

const missionExceptionSchema = z.object({
  type: z.enum(["delay", "breakdown", "reroute", "no_show"]),
  description: z.string().optional().default(""),
  actorId: z.string().min(1),
});

function parseMissionStatus(value: string): MissionStatus | null {
  const parsed = missionStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function toHttpErrorStatus(error: unknown): 400 | 404 | 500 {
  if (!(error instanceof MissionDomainError)) {
    return 500;
  }

  if (error.code === "not_found") {
    return 404;
  }

  if (error.code === "invalid_request" || error.code === "invalid_transition") {
    return 400;
  }

  return 500;
}

function errorMessage(error: unknown): string {
  if (error instanceof MissionDomainError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Internal server error";
}

  app.get("/", (c) => {
    return c.json({ service: "nafa-data-service", status: "ok" });
  });

  app.get("/api/missions", (c) => {
    const status = c.req.query("status");
    const parsedFilters = missionFilterSchema.safeParse({
      route: c.req.query("route"),
      depot: c.req.query("depot"),
      driverId: c.req.query("driverId"),
      vehicleId: c.req.query("vehicleId"),
      serviceDateFrom: c.req.query("serviceDateFrom"),
      serviceDateTo: c.req.query("serviceDateTo"),
    });

    if (!parsedFilters.success) {
      return c.json({ error: "Invalid query parameters" }, 400);
    }

    const list = resolvedMissionStore.listMissions(parsedFilters.data);
    if (!status) {
      return c.json({ missions: list });
    }

    const parsedStatus = parseMissionStatus(status);
    if (!parsedStatus) {
      return c.json({ error: "Invalid status filter" }, 400);
    }

    return c.json({ missions: list.filter((mission) => mission.status === parsedStatus) });
  });

  app.get("/api/missions/:missionId", (c) => {
    try {
      const mission = resolvedMissionStore.getMissionOrThrow(c.req.param("missionId"));
      return c.json({ mission });
    } catch (error) {
      return c.json({ error: errorMessage(error) }, toHttpErrorStatus(error));
    }
  });

  app.patch("/api/missions/:missionId/status", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsedBody = missionStatusUpdateSchema.safeParse(body);

    if (!parsedBody.success) {
      return c.json({ error: "Invalid status payload" }, 400);
    }

    try {
      const mission = resolvedMissionStore.updateStatus({
        missionId: c.req.param("missionId"),
        nextStatus: parsedBody.data.status,
        actorId: parsedBody.data.actorId,
      });
      return c.json({ mission });
    } catch (error) {
      return c.json({ error: errorMessage(error) }, toHttpErrorStatus(error));
    }
  });

  app.post("/api/missions/:missionId/assignments", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsedBody = missionAssignmentSchema.safeParse(body);

    if (!parsedBody.success) {
      return c.json({ error: "Invalid assignment payload" }, 400);
    }

    try {
      const result = resolvedMissionStore.assignMission({
        missionId: c.req.param("missionId"),
        ...parsedBody.data,
      });
      return c.json(result, 201);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, toHttpErrorStatus(error));
    }
  });

  app.get("/api/missions/:missionId/assignment-history", (c) => {
    try {
      const history = resolvedMissionStore.listAssignmentHistory(c.req.param("missionId"));
      return c.json({ history });
    } catch (error) {
      return c.json({ error: errorMessage(error) }, toHttpErrorStatus(error));
    }
  });

  app.get("/api/missions/:missionId/status-history", (c) => {
    try {
      const history = resolvedMissionStore.listStatusHistory(c.req.param("missionId"));
      return c.json({ history });
    } catch (error) {
      return c.json({ error: errorMessage(error) }, toHttpErrorStatus(error));
    }
  });

  app.post("/api/missions/:missionId/exceptions", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsedBody = missionExceptionSchema.safeParse(body);

    if (!parsedBody.success) {
      return c.json({ error: "Invalid exception payload" }, 400);
    }

    try {
      const exception = resolvedMissionStore.addException({
        missionId: c.req.param("missionId"),
        ...parsedBody.data,
      });
      return c.json({ exception }, 201);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, toHttpErrorStatus(error));
    }
  });

  app.get("/api/missions/:missionId/exceptions", (c) => {
    try {
      const exceptions = resolvedMissionStore.listExceptions(c.req.param("missionId"));
      return c.json({ exceptions });
    } catch (error) {
      return c.json({ error: errorMessage(error) }, toHttpErrorStatus(error));
    }
  });

  app.get("/api/missions/:missionId/timeline", (c) => {
    try {
      const events = resolvedMissionStore.getMissionTimeline(c.req.param("missionId"));
      return c.json({ events });
    } catch (error) {
      return c.json({ error: errorMessage(error) }, toHttpErrorStatus(error));
    }
  });

  app.get("/api/kpi/missions/summary", (c) => {
    const parsedFilters = missionKpiSummaryFilterSchema.safeParse({
      from: c.req.query("from"),
      to: c.req.query("to"),
      route: c.req.query("route"),
      depot: c.req.query("depot"),
    });

    if (!parsedFilters.success) {
      return c.json({ error: "Invalid KPI query parameters" }, 400);
    }

    return c.json(resolvedMissionStore.summarizeKpis(parsedFilters.data));
  });

  return app;
}

let appInstance: ReturnType<typeof createApp> | undefined;

function getAppInstance() {
  if (!appInstance) {
    appInstance = createApp();
  }

  return appInstance;
}

export const app = {
  fetch(request: Request, env?: Env, executionCtx?: ExecutionContext) {
    return getAppInstance().fetch(request, env, executionCtx);
  },
};
