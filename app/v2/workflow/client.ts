import { isCanonicalProviderId, validateEquipment, type ExperienceInput, type StopAction, type WorkdayAggregate, type WorkdayStop } from "../domain/workday.ts";

type WorkflowClientDependencies = {
  fetcher?: typeof fetch;
  keyFactory: () => string;
  onCurrentWorkday: (workday: WorkdayAggregate) => void;
};

export class StaleWorkflowResponseError extends Error {
  constructor() {
    super("A stale workflow response was ignored.");
    this.name = "StaleWorkflowResponseError";
  }
}

function isStop(value: unknown): value is WorkdayStop {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const stop = value as Partial<WorkdayStop>;
  return typeof stop.id === "string" && stop.id.length > 0 && isCanonicalProviderId(stop.providerId) && typeof stop.displayName === "string" && stop.displayName.length > 0 && typeof stop.address === "string" && stop.address.length > 0 && Number.isInteger(stop.order) && ["delivery", "pickup", "drop_hook", "delivery_pickup"].includes(stop.type ?? "") && ["pending", "navigating", "arrived", "departed", "experience_published"].includes(stop.state ?? "");
}

export function isAuthoritativeWorkday(value: unknown): value is WorkdayAggregate {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const workday = value as Partial<WorkdayAggregate>;
  let validEquipment = false;
  try { validateEquipment(workday.equipment); validEquipment = true; } catch { validEquipment = false; }
  const validStops = Array.isArray(workday.stops) && workday.stops.every((stop, index) => isStop(stop) && stop.order === index);
  const validIndex = Number.isInteger(workday.activeStopIndex) && (workday.activeStopIndex as number) >= 0 && (workday.activeStopIndex as number) <= (Array.isArray(workday.stops) ? workday.stops.length : -1);
  if (!(typeof workday.id === "string"
    && ["setup", "active", "completed"].includes(workday.state ?? "")
    && validIndex
    && validEquipment
    && validStops)) return false;
  const stops = workday.stops as WorkdayStop[];
  const activeIndex = workday.activeStopIndex as number;
  if (new Set(stops.map(stop => stop.id)).size !== stops.length || new Set(stops.map(stop => stop.providerId)).size !== stops.length) return false;
  if (workday.state === "completed") return stops.length > 0 && activeIndex === stops.length && stops.every(stop => stop.state === "experience_published");
  if (workday.state === "setup") return activeIndex === 0 && stops.every(stop => stop.state === "pending");
  if (stops.length === 0) return false;
  if (activeIndex === stops.length) return stops.every(stop => stop.state === "experience_published");
  return stops.every((stop, index) => index < activeIndex
    ? stop.state === "experience_published"
    : index === activeIndex
      ? stop.state !== "experience_published"
      : stop.state === "pending");
}

async function errorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: { message?: unknown } } | null;
  if (typeof body?.error?.message === "string") return body.error.message;
  if (response.status === 401) return "Your sign-in expired. Sign in again, then retry.";
  return "We couldn’t update your workday. Try again.";
}

export function createWorkflowMutationClient(dependencies: WorkflowClientDependencies) {
  const fetcher = dependencies.fetcher ?? fetch;
  let latestTicket = 0;
  const logicalKeys = new Map<string, string>();
  const flights = new Map<string, Promise<WorkdayAggregate>>();

  const mutate = async (url: string, body: unknown, key: string): Promise<WorkdayAggregate> => {
    const ticket = ++latestTicket;
    const response = await fetcher(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    const payload = await response.json().catch(() => null) as { workday?: unknown } | null;
    if (!isAuthoritativeWorkday(payload?.workday)) throw new Error("The server did not return an authoritative workday.");
    if (ticket !== latestTicket) throw new StaleWorkflowResponseError();
    dependencies.onCurrentWorkday(payload.workday);
    return payload.workday;
  };

  const logicalMutation = (signature: string, url: string, body: unknown) => {
    const existing = flights.get(signature);
    if (existing) return existing;
    const key = logicalKeys.get(signature) ?? dependencies.keyFactory();
    logicalKeys.set(signature, key);
    const flight = mutate(url, body, key).then(workday => {
      logicalKeys.delete(signature);
      flights.delete(signature);
      return workday;
    }, error => {
      flights.delete(signature);
      throw error;
    });
    flights.set(signature, flight);
    return flight;
  };

  return {
    event: (stopId: string, action: StopAction) => logicalMutation(`event:${stopId}:${action}`, `/api/v2/stops/${encodeURIComponent(stopId)}/events`, { action }),
    publish: (stopId: string, input: ExperienceInput, idempotencyKey: string) => mutate(`/api/v2/stops/${encodeURIComponent(stopId)}/experience`, input, idempotencyKey),
    finish: (workdayId: string) => logicalMutation(`finish:${workdayId}`, "/api/v2/workday", { action: "finish", workdayId }),
  };
}
