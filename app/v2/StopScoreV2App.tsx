"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkdayAggregate } from "./domain/workday.ts";
import { AppShell } from "./components/AppShell";
import { EquipmentFlow } from "./components/EquipmentFlow";
import { Home } from "./components/Home";
import { RouteFlow } from "./components/RouteFlow";
import { WorkMode } from "./components/WorkMode";
import { ExperienceFlow } from "./components/ExperienceFlow";
import { FinishDay } from "./components/FinishDay";
import { WorkflowStatus } from "./components/WorkflowStatus";
import { initialSetupState, setupReducer, type SetupAction, type SetupState } from "./setup/model.ts";
import { handleModalKey, restoreModalFocus } from "./setup/controllers.ts";
import {
  clearSetupDraft,
  createPersistedSetupDraft,
  DISMISSED_COMPLETED_KEY,
  loadSetupDraft,
  resolveSetupAuthority,
  restoreSetupState,
  saveSetupDraft,
} from "./setup/recovery.ts";
import { useWorkday } from "./useWorkday";

type View = "loading" | "home" | "setup" | "active" | "completed";
const sessionEndpoint = "/api/session";
const signInHref = "/signin-with-chatgpt?return_to=%2F";

const localStorageOrNull = () => typeof window === "undefined" ? null : window.localStorage;
const readDismissedCompletedId = () => {
  try { return localStorageOrNull()?.getItem(DISMISSED_COMPLETED_KEY) ?? null; } catch { return null; }
};

function setupFromServer(workday: WorkdayAggregate): SetupState {
  const equipment = workday.equipment;
  return {
    ...initialSetupState(),
    stage: workday.stops.length ? "route-list" : "route-search",
    equipmentDraft: {
      type: equipment.type,
      truckNumber: equipment.truckNumber,
      odometer: equipment.odometer,
      trailerType: equipment.trailerType ?? "",
      trailerNumber: equipment.trailerNumber ?? "",
    },
    validatedEquipment: { ...equipment },
    committedStops: workday.stops.map(stop => ({ providerId: stop.providerId, displayName: stop.displayName, address: stop.address, type: stop.type, order: stop.order })),
  };
}

export type WorkdayClientState = ReturnType<typeof useWorkday>;

export function StopScoreWorkspace({ client }: { client: WorkdayClientState }) {
  const { session, workday, loadingWorkday, refresh, start, recordEvent, publishExperience, finishWorkday } = client;
  const [view, setView] = useState<View>("loading");
  const [setup, setSetup] = useState<SetupState>(initialSetupState);
  const [signInOpen, setSignInOpen] = useState(false);
  const [resolvedOwner, setResolvedOwner] = useState<string | null>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const signInLink = useRef<HTMLAnchorElement>(null);
  const cancelSignInButton = useRef<HTMLButtonElement>(null);

  const dispatch = useCallback((action: SetupAction) => setSetup(current => setupReducer(current, action)), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
    if (session.status === "loading" || loadingWorkday) {
      setResolvedOwner(null);
      setSetup(initialSetupState());
      setView("loading");
      return;
    }
    if (session.status !== "authenticated") {
      setResolvedOwner(null);
      setSetup(initialSetupState());
      setView("home");
      return;
    }
    const storage = localStorageOrNull();
    const draft = loadSetupDraft(storage, session.user.email);
    const authority = resolveSetupAuthority({ server: workday, draft, dismissedCompletedId: readDismissedCompletedId() });
    if (authority.clearDraft) clearSetupDraft(storage);
    if (authority.source === "server") {
      if (authority.aggregate.state === "active") setView("active");
      else if (authority.aggregate.state === "completed") setView("completed");
      else { setSetup(setupFromServer(authority.aggregate)); setView("setup"); }
    } else if (authority.source === "draft") {
      setSetup(restoreSetupState(authority.draft));
      setView("setup");
    } else {
      setView("home");
    }
    setResolvedOwner(session.user.email.trim().toLowerCase());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadingWorkday, session, workday]);

  useEffect(() => {
    if (view !== "setup") return;
    if (session.status !== "authenticated") return;
    if (resolvedOwner !== session.user.email.trim().toLowerCase()) return;
    saveSetupDraft(localStorageOrNull(), createPersistedSetupDraft(setup, session.user.email));
  }, [resolvedOwner, session, setup, view]);

  useEffect(() => {
    if (signInOpen) signInLink.current?.focus();
  }, [signInOpen]);

  const begin = () => {
    if (session.status === "authenticated") {
      setView("setup");
      return;
    }
    if (session.status === "unauthenticated") setSignInOpen(true);
  };

  const cancelSignIn = () => {
    setSignInOpen(false);
    requestAnimationFrame(() => restoreModalFocus(startButton.current, startButton.current));
  };

  const prepare = async () => {
    if (!setup.validatedEquipment || setup.committedStops.length === 0) throw new Error("Complete your equipment and route first.");
    const result = await start({ equipment: setup.validatedEquipment, stops: setup.committedStops });
    if (result.state === "active") {
      clearSetupDraft(localStorageOrNull());
      setView("active");
    }
    return result;
  };

  const dismissCompleted = () => {
    if (!workday || workday.state !== "completed") return;
    try { localStorageOrNull()?.setItem(DISMISSED_COMPLETED_KEY, workday.id); } catch { /* setup remains usable without storage */ }
    setSetup(initialSetupState());
    setView("home");
  };

  const sessionOwner = session.status === "authenticated" ? session.user.email.trim().toLowerCase() : null;
  const visibleView: View = session.status === "loading" || loadingWorkday
    ? "loading"
    : session.status !== "authenticated"
      ? "home"
      : resolvedOwner === sessionOwner ? view : "loading";

  return (
    <>
      {visibleView === "loading" ? <div className="v2-loading" role="status"><div className="v2-loading-card"><div className="v2-loading-brand" aria-label="StopScore"><b>STOP</b><b>SCORE</b></div><span aria-hidden="true" /><p>Loading your driver workspace…</p><small>Preparing today’s driver tools</small></div></div> : null}
      {visibleView === "home" ? <Home ref={startButton} session={session} onStart={begin} onRetrySession={() => void refresh()} /> : null}
      {visibleView === "setup" && (["equipment-choice", "trailer-choice", "equipment-info", "equipment-ready"] as const).includes(setup.stage as "equipment-choice") ? <EquipmentFlow state={setup} dispatch={dispatch} onExit={() => setView("home")} /> : null}
      {visibleView === "setup" && !["equipment-choice", "trailer-choice", "equipment-info", "equipment-ready"].includes(setup.stage) ? <RouteFlow state={setup} dispatch={dispatch} onPrepare={prepare} /> : null}
      {workday && (visibleView === "active" || visibleView === "completed") ? <WorkflowStatus workday={workday} /> : null}
      {visibleView === "active" && workday && workday.stops[workday.activeStopIndex]?.state !== "departed" && workday.activeStopIndex < workday.stops.length ? <WorkMode workday={workday} onEvent={recordEvent} /> : null}
      {visibleView === "active" && workday && workday.stops[workday.activeStopIndex]?.state === "departed" ? <ExperienceFlow key={workday.stops[workday.activeStopIndex].id} workdayId={workday.id} stop={workday.stops[workday.activeStopIndex]} onPublish={publishExperience} /> : null}
      {visibleView === "active" && workday && workday.activeStopIndex >= workday.stops.length ? <FinishDay workday={workday} onFinish={finishWorkday} onDismiss={dismissCompleted} /> : null}
      {visibleView === "completed" && workday ? <FinishDay workday={workday} onFinish={finishWorkday} onDismiss={dismissCompleted} /> : null}

      {signInOpen ? <div className="v2-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) cancelSignIn(); }}><div className="v2-signin-dialog" role="dialog" aria-modal="true" aria-labelledby="signin-title" aria-describedby="signin-description" onKeyDown={event => handleModalKey({ key: event.key, shiftKey: event.shiftKey, activeElement: document.activeElement, first: signInLink.current, last: cancelSignInButton.current, preventDefault: () => event.preventDefault(), onEscape: cancelSignIn })}>
        <p className="v2-eyebrow">Driver sign-in</p><h2 id="signin-title">Sign in to start your day</h2><p id="signin-description">Your setup draft stays on this device while you sign in.</p><a ref={signInLink} className="v2-primary-button" href={signInHref}>Continue to Sign In</a><button ref={cancelSignInButton} className="v2-secondary-button" type="button" onClick={cancelSignIn}>Cancel</button>
      </div></div> : null}
    </>
  );
}

export default function StopScoreV2App() {
  const client = useWorkday(sessionEndpoint);
  return <AppShell session={client.session}><StopScoreWorkspace client={client} /></AppShell>;
}
