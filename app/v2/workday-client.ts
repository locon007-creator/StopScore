import type { Equipment, RouteStopInput, WorkdayAggregate } from "./domain/workday.ts";
import { isAuthoritativeWorkday } from "./workflow/client.ts";

export type StartPayload = { equipment: Equipment; stops: RouteStopInput[] };
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

class DefinitiveStartError extends Error {}

function signature(payload: StartPayload) {
  return JSON.stringify({
    equipment: {
      type: payload.equipment.type,
      truckNumber: payload.equipment.truckNumber,
      odometer: payload.equipment.odometer,
      trailerType: payload.equipment.trailerType ?? null,
      trailerNumber: payload.equipment.trailerNumber ?? null,
    },
    stops: payload.stops.map(stop => ({ providerId: stop.providerId, displayName: stop.displayName, address: stop.address, type: stop.type, order: stop.order })),
  });
}

async function postStart(fetcher: Fetcher, payload: StartPayload, key: string): Promise<WorkdayAggregate> {
  const response = await fetcher("/api/v2/workday", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ action: "start", equipment: payload.equipment, stops: payload.stops }),
  });
  const body = await response.json().catch(() => null) as { workday?: unknown; error?: { message?: string } } | null;
  if (!response.ok) throw new DefinitiveStartError(body?.error?.message || "We couldn’t start your workday. Try again.");
  if (!isAuthoritativeWorkday(body?.workday) || body.workday.state !== "active") throw new Error("We couldn’t start your workday. Try again.");
  return body.workday;
}

export function createWorkdayStartClient(options: {
  fetcher?: Fetcher;
  keyFactory: () => string;
  onCurrentWorkday: (workday: WorkdayAggregate) => void;
}) {
  const fetcher = options.fetcher ?? fetch;
  type Intent = {
    payload: StartPayload;
    signature: string;
    promise: Promise<WorkdayAggregate>;
    resolve: (workday: WorkdayAggregate) => void;
    reject: (error: unknown) => void;
  };
  const keys = new Map<string, string>();
  let active: Intent | null = null;
  let queued: Intent | null = null;
  let uncertain: Pick<Intent, "payload" | "signature"> | null = null;

  const intent = (payload: StartPayload, payloadSignature: string): Intent => {
    let resolve!: (workday: WorkdayAggregate) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<WorkdayAggregate>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { payload, signature: payloadSignature, promise, resolve, reject };
  };

  const keyFor = (payloadSignature: string) => {
    const existing = keys.get(payloadSignature);
    if (existing) return existing;
    const created = options.keyFactory();
    keys.set(payloadSignature, created);
    return created;
  };

  const launch = (next: Intent, reconciling = false) => {
    active = next;
    void postStart(fetcher, next.payload, keyFor(next.signature)).then(workday => {
      keys.delete(next.signature);
      uncertain = null;
      active = null;
      const waiting = queued;
      queued = null;
      try {
        options.onCurrentWorkday(workday);
        next.resolve(workday);
        waiting?.resolve(workday);
      } catch (error) {
        next.reject(error);
        waiting?.reject(error);
      }
    }, error => {
      const waiting = queued;
      if (!(error instanceof DefinitiveStartError)) {
        uncertain = { payload: next.payload, signature: next.signature };
        if (waiting && !reconciling) {
          launch(next, true);
          return;
        }
      } else if (uncertain?.signature === next.signature) {
        uncertain = null;
      }
      active = null;
      next.reject(error);
      queued = null;
      if (waiting) {
        if (error instanceof DefinitiveStartError) launch(waiting);
        else waiting.reject(error);
      }
    });
  };

  return {
    start(payload: StartPayload): Promise<WorkdayAggregate> {
      const payloadSignature = signature(payload);
      if (active) {
        if (active.signature === payloadSignature && !queued) return active.promise;
        if (queued) {
          queued.payload = payload;
          queued.signature = payloadSignature;
          return queued.promise;
        }
        queued = intent(payload, payloadSignature);
        return queued.promise;
      }
      if (uncertain) {
        const recovery = intent(uncertain.payload, uncertain.signature);
        if (payloadSignature !== uncertain.signature) queued = intent(payload, payloadSignature);
        launch(recovery, true);
        return queued?.promise ?? recovery.promise;
      }
      const next = intent(payload, payloadSignature);
      launch(next);
      return next.promise;
    },
  };
}

export function createRequestLifecycle() {
  let mounted = false;
  let ticket = 0;
  return {
    mount() {
      mounted = true;
      return () => {
        mounted = false;
        ticket += 1;
      };
    },
    begin() {
      ticket += 1;
      return ticket;
    },
    isCurrent(candidate: number) {
      return mounted && candidate === ticket;
    },
    isMounted() {
      return mounted;
    },
  };
}
