import { ConflictError, MissingError, ValidationError } from "../domain/workday.ts";
import type { WorkdayRepository } from "./workday-repository.ts";
import { WorkdayService } from "./workday-service.ts";

type AuthenticatedUser = { email: string };
type HttpDependencies = {
  authenticate: () => Promise<AuthenticatedUser | null>;
  createRepository: () => Promise<WorkdayRepository> | WorkdayRepository;
};

const unauthenticated = () => Response.json(
  { error: { code: "unauthenticated", message: "Sign in to use your workday." } },
  { status: 401 },
);

const invalidBody = () => Response.json(
  { error: { code: "validation", message: "The request body is invalid." } },
  { status: 400 },
);

function errorResponse(error: unknown) {
  if (error instanceof ValidationError) {
    return Response.json({ error: { code: "validation", message: error.message } }, { status: 400 });
  }
  if (error instanceof MissingError) {
    return Response.json({ error: { code: "missing", message: error.message } }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    return Response.json({ error: { code: "conflict", message: error.message } }, { status: 409 });
  }
  return Response.json(
    { error: { code: "storage", message: "The workday service is temporarily unavailable." } },
    { status: 500 },
  );
}

type ParsedBody =
  | { ok: true; body: unknown }
  | { ok: false; response: Response };

async function parseBody(request: Request): Promise<ParsedBody> {
  try {
    return { ok: true, body: await request.json() as unknown };
  } catch {
    return { ok: false, response: invalidBody() };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("The request body is invalid.");
  }
  return value as Record<string, unknown>;
}

export function createWorkflowHttpHandlers(dependencies: HttpDependencies) {
  const service = async () => new WorkdayService(await dependencies.createRepository());

  return {
    getWorkday: async () => {
      const user = await dependencies.authenticate();
      if (!user) return unauthenticated();
      try {
        const workday = await (await service()).getCurrent(user.email);
        return Response.json({ workday });
      } catch (error) {
        return errorResponse(error);
      }
    },

    postWorkday: async (request: Request) => {
      const user = await dependencies.authenticate();
      if (!user) return unauthenticated();
      const parsed = await parseBody(request);
      if (!parsed.ok) return parsed.response;
      try {
        const body = asRecord(parsed.body);
        const key = request.headers.get("Idempotency-Key");
        const workflow = await service();
        if (body.action === "start") {
          const workday = await workflow.start(user.email, { equipment: body.equipment, stops: body.stops }, key);
          return Response.json({ workday }, { status: 201 });
        }
        if (body.action === "finish") {
          const workday = await workflow.finish(user.email, body.workdayId, key, body.endingOdometer);
          return Response.json({ workday });
        }
        throw new ValidationError("Workday action is invalid.");
      } catch (error) {
        return errorResponse(error);
      }
    },

    postStopEvent: async (request: Request, stopId: string) => {
      const user = await dependencies.authenticate();
      if (!user) return unauthenticated();
      const parsed = await parseBody(request);
      if (!parsed.ok) return parsed.response;
      try {
        const body = asRecord(parsed.body);
        const workday = await (await service()).recordStopEvent(
          user.email,
          stopId,
          body.action,
          request.headers.get("Idempotency-Key"),
        );
        return Response.json({ workday });
      } catch (error) {
        return errorResponse(error);
      }
    },

    postExperience: async (request: Request, stopId: string) => {
      const user = await dependencies.authenticate();
      if (!user) return unauthenticated();
      const parsed = await parseBody(request);
      if (!parsed.ok) return parsed.response;
      try {
        const workday = await (await service()).publishExperience(
          user.email,
          stopId,
          parsed.body,
          request.headers.get("Idempotency-Key"),
        );
        return Response.json({ workday });
      } catch (error) {
        return errorResponse(error);
      }
    },

    getStopKnowledge: async (stopId: string) => {
      const user = await dependencies.authenticate();
      if (!user) return unauthenticated();
      try {
        const knowledge = await (await service()).stopKnowledge(user.email, stopId);
        return Response.json({ knowledge });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
