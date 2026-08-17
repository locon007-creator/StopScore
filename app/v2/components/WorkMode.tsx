"use client";

import { useState } from "react";
import { BookOpen, Copy, FlagCheckered, Info, NavigationArrow, Truck } from "@phosphor-icons/react";
import type { StopAction, StopType, WorkdayAggregate } from "../domain/workday.ts";
import { DROP_HOOK_DETAIL_LABELS, getWorkModeAction, navigationTarget } from "../workflow/model.ts";
import { formatClockTime, formatDuration } from "../workflow/time.ts";
import { StopKnowledgePanel } from "./StopKnowledgePanel";

const trailerLabels: Record<string, string> = { dry_van: "Dry Van", reefer: "Reefer", flatbed: "Flatbed", step_deck: "Step Deck", tanker: "Tanker", other: "Other" };
const stopTypeLabel: Record<StopType, string> = { delivery: "Delivery", pickup: "Pickup", drop_hook: "Drop & Hook", delivery_pickup: "Delivery & Pickup" };

export function WorkMode({ workday, onEvent }: { workday: WorkdayAggregate; onEvent: (stopId: string, action: StopAction) => Promise<WorkdayAggregate> }) {
  const stop = workday.stops[workday.activeStopIndex];
  const nextStop = workday.stops[workday.activeStopIndex + 1];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  if (!stop) return null;
  const legal = getWorkModeAction(stop.state);
  const navigation = navigationTarget(stop.address);
  const arrivedAtLabel = formatClockTime(stop.arrivedAt);
  const departedAtLabel = formatClockTime(stop.departedAt);
  const onSiteLabel = formatDuration(stop.arrivedAt, stop.departedAt);
  const completedStops = workday.stops
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => index < workday.activeStopIndex);
  const equipmentValues = [
    workday.equipment.truckNumber,
    workday.equipment.trailerType ? trailerLabels[workday.equipment.trailerType] : "Not applicable",
    workday.equipment.trailerNumber ?? "Not applicable",
    workday.equipment.odometer,
  ];

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(navigation.address);
      setCopyStatus("Address copied.");
    } catch {
      setCopyStatus("Copy unavailable. Select the address above to copy it.");
    }
  };

  const act = async () => {
    if (!legal || legal.kind !== "event") return;
    setBusy(true);
    setError(null);
    if (legal.action === "navigate") window.open(navigation.href, "_blank", "noopener,noreferrer");
    try {
      await onEvent(stop.id, legal.action);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t update this stop. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return <section className={`v2-work-mode state-${stop.state}`} aria-labelledby="workmode-title">
    <div className="v2-work-progress">
      <span>Stop {workday.activeStopIndex + 1} of {workday.stops.length}</span>
      <div className="v2-street-progress" aria-hidden="true">
        <i className="v2-progress-road" />
        {workday.stops.map((item, index) => <i key={item.id} className={`v2-progress-marker ${index < workday.activeStopIndex ? "complete" : index === workday.activeStopIndex ? "current" : "upcoming"}`}>{index + 1}</i>)}
        <FlagCheckered className="v2-progress-finish" weight="fill" />
      </div>
    </div>

    <article className="v2-active-stop-panel">
      <div className="v2-stop-identity">
        <div><p className="v2-eyebrow">Current Stop</p><h1 id="workmode-title" tabIndex={-1}>{stop.displayName}</h1><p>{navigation.address}</p><button className="v2-copy-address" type="button" onClick={() => void copyAddress()}><Copy aria-hidden="true" />Copy address</button><span className="v2-sr-status" aria-live="polite">{copyStatus}</span></div>
        <small>{stopTypeLabel[stop.type]}</small>
      </div>
      <div className="v2-equipment-inline" aria-label="Active equipment"><Truck aria-hidden="true" /><span>Truck #{equipmentValues[0]} · {equipmentValues[1]} · TRL #{equipmentValues[2]}</span></div>
    </article>

    {stop.state !== "pending" ? <div className="v2-arrival-strip">
      <strong>ARRIVAL</strong>
      <span>{arrivedAtLabel ? (departedAtLabel ? `${arrivedAtLabel} · Departed ${departedAtLabel}` : arrivedAtLabel) : "Recorded for this stop"}</span>
      {onSiteLabel ? <span className="v2-arrival-duration">On site {onSiteLabel}</span> : null}
    </div> : null}
    <button className="v2-knowledge-row" type="button" onClick={() => setKnowledgeOpen(true)}><BookOpen aria-hidden="true" /><span>Stop Knowledge</span><NavigationArrow aria-hidden="true" /></button>

    {nextStop ? <article className="v2-next-stop-card"><p className="v2-eyebrow">Next Stop</p><strong>{nextStop.displayName}</strong><span>{nextStop.address}</span></article> : null}

    {stop.type === "drop_hook" ? <dl className="v2-drop-hook-details">{DROP_HOOK_DETAIL_LABELS.map(label => <div key={label}><dt>{label}</dt><dd>Not recorded in route setup</dd></div>)}</dl> : null}
    {error ? <div className="v2-workflow-error" role="alert"><p>{error}</p>{error.toLowerCase().includes("sign in") || error.toLowerCase().includes("sign-in") ? <a href="/signin-with-chatgpt?return_to=%2F">Sign in again</a> : null}</div> : null}

    <div className="v2-work-actions">
      {legal?.kind === "event" ? <button id={`workmode-${stop.id}-action`} className="v2-primary-button v2-work-action" type="button" disabled={busy} onClick={() => void act()}>{busy ? "Updating…" : legal.label}<NavigationArrow aria-hidden="true" weight="fill" /></button> : null}
      {legal?.kind === "event" && legal.action === "navigate" ? <div className="v2-navigation-boundary"><Info aria-hidden="true" weight="fill" /><p>Opens your map app. StopScore is not a GPS.</p></div> : null}
    </div>
    {completedStops.length > 0 ? <details className="v2-completed-stops">
      <summary>Completed Stops ({completedStops.length})</summary>
      <ol>
        {completedStops.map(({ item, index }) => {
          const arrived = formatClockTime(item.arrivedAt);
          const departed = formatClockTime(item.departedAt);
          const onSite = formatDuration(item.arrivedAt, item.departedAt);
          return <li key={item.id}>
            <p className="v2-completed-stop-name"><span className="v2-completed-stop-index">{index + 1}</span>{item.displayName}</p>
            <p className="v2-completed-stop-meta">{stopTypeLabel[item.type]}{arrived ? ` · Arrived ${arrived}` : ""}{departed ? ` · Departed ${departed}` : ""}</p>
            {onSite ? <p className="v2-completed-stop-meta">On site {onSite}</p> : null}
          </li>;
        })}
      </ol>
    </details> : null}
    {knowledgeOpen ? <StopKnowledgePanel stop={stop} onClose={() => setKnowledgeOpen(false)} /> : null}
  </section>;
}
