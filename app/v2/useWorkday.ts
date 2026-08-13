"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkdayAggregate } from "./domain/workday.ts";
import { createRequestLifecycle, createWorkdayStartClient, type StartPayload } from "./workday-client.ts";
import { createWorkflowMutationClient, isAuthoritativeWorkday } from "./workflow/client.ts";

export type DriverSession = { displayName: string; email: string };
export type SessionState =
  | { status: "loading" }
  | { status: "authenticated"; user: DriverSession }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

const idempotencyKey = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `setup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export function useWorkday(sessionEndpoint = "/api/session") {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [workday, setWorkday] = useState<WorkdayAggregate | null>(null);
  const [loadingWorkday, setLoadingWorkday] = useState(true);
  const [lifecycle] = useState(createRequestLifecycle);
  const [applyCurrentWorkday] = useState(() => (current: WorkdayAggregate) => {
    if (!lifecycle.isMounted()) return;
    lifecycle.begin();
    setWorkday(current);
  });
  const [startClient] = useState(() => createWorkdayStartClient({
    keyFactory: idempotencyKey,
    onCurrentWorkday: applyCurrentWorkday,
  }));
  const [workflowClient] = useState(() => createWorkflowMutationClient({
    keyFactory: idempotencyKey,
    onCurrentWorkday: applyCurrentWorkday,
  }));

  useEffect(() => lifecycle.mount(), [lifecycle]);

  const refresh = useCallback(async () => {
    const ticket = lifecycle.begin();
    setSession({ status: "loading" });
    setLoadingWorkday(true);
    try {
      const sessionResponse = await fetch(sessionEndpoint, { headers: { Accept: "application/json" } });
      if (!sessionResponse.ok) throw new Error("session");
      const sessionBody = await sessionResponse.json() as { user?: unknown };
      if (!sessionBody.user || typeof sessionBody.user !== "object") {
        if (lifecycle.isCurrent(ticket)) {
          setSession({ status: "unauthenticated" });
          setWorkday(null);
          setLoadingWorkday(false);
        }
        return;
      }
      const user = sessionBody.user as Record<string, unknown>;
      if (typeof user.displayName !== "string" || typeof user.email !== "string") throw new Error("session");
      const workdayResponse = await fetch("/api/v2/workday", { headers: { Accept: "application/json" } });
      if (!workdayResponse.ok) throw new Error("workday");
      const body = await workdayResponse.json() as { workday?: unknown };
      if (body.workday !== null && body.workday !== undefined && !isAuthoritativeWorkday(body.workday)) throw new Error("workday");
      if (lifecycle.isCurrent(ticket)) {
        setSession({ status: "authenticated", user: { displayName: user.displayName, email: user.email } });
        setWorkday(isAuthoritativeWorkday(body.workday) ? body.workday : null);
        setLoadingWorkday(false);
      }
    } catch {
      if (lifecycle.isCurrent(ticket)) {
        setSession({ status: "error", message: "We couldn’t check your sign-in. Check your connection and try again." });
        setLoadingWorkday(false);
      }
    }
  }, [lifecycle, sessionEndpoint]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const start = useCallback((payload: StartPayload) => {
    return startClient.start(payload);
  }, [startClient]);

  return {
    session,
    workday,
    loadingWorkday,
    refresh,
    start,
    recordEvent: workflowClient.event,
    publishExperience: workflowClient.publish,
    finishWorkday: workflowClient.finish,
  };
}
