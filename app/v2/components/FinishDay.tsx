"use client";

import { useState } from "react";
import { CheckCircle, House, Info } from "@phosphor-icons/react";
import type { WorkdayAggregate } from "../domain/workday.ts";
import { formatClockTime, formatWaitingDuration, stopWaitingMinutes, totalMiles } from "../workflow/model.ts";

export function FinishDay({ workday, onFinish, onDismiss }: { workday: WorkdayAggregate; onFinish: (workdayId: string, endingOdometer?: string) => Promise<WorkdayAggregate>; onDismiss: () => void }) {
  const [status, setStatus] = useState<"idle" | "finishing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const completed = workday.state === "completed";
  const [step, setStep] = useState<"home-base" | "summary">(completed ? "summary" : "home-base");
  // A driver can finish without recording an ending reading; nothing here guesses one.
  const [endingOdometerDraft, setEndingOdometerDraft] = useState("");
  const endingOdometer = completed ? (workday.endingOdometer ?? null) : (endingOdometerDraft.trim() || null);
  const miles = totalMiles(workday.equipment.odometer, endingOdometer);
  const finish = async () => {
    setStatus("finishing"); setError(null);
    try { await onFinish(workday.id, endingOdometerDraft.trim() || undefined); }
    catch (cause) { setStatus("error"); setError(cause instanceof Error ? cause.message : "We couldn’t finish your workday. Try again."); }
  };
  if (step === "home-base") return <section className="v2-finish-day v2-home-base" aria-labelledby="home-base-title">
    <div className="v2-work-progress"><span>Route complete</span><div className="v2-street-progress" aria-hidden="true"><i className="v2-progress-road" />{workday.stops.map(stop => <i key={stop.id} className="v2-progress-marker complete" />)}<CheckCircle className="v2-progress-finish" weight="fill" /></div></div>
    <div className="v2-status-mark" aria-hidden="true"><House weight="duotone" /></div><p className="v2-eyebrow">All stops complete</p><h1 id="home-base-title">Proceed to Home Base</h1>
    <div className="v2-home-base-card"><House aria-hidden="true" weight="duotone" /><strong>Home Base</strong><p>Home Base address is not set.</p></div>
    <div className="v2-navigation-boundary"><Info aria-hidden="true" weight="fill" /><p>Set a verified Home Base before navigation can open safely. StopScore will not guess an address.</p></div>
    <button className="v2-primary-button" type="button" onClick={() => setStep("summary")}>Continue to Day Summary</button>
  </section>;
  // Times come from what was recorded. A day with nothing recorded shows no timeline rather
  // than inventing one.
  const startedAt = formatClockTime(workday.createdAt);
  return <section className="v2-finish-day" aria-labelledby="finish-day-title">
    <div className="v2-status-mark" aria-hidden="true"><CheckCircle weight="duotone" /></div><p className="v2-eyebrow">{completed ? "Workday complete" : "Route complete"}</p>
    <h1 id="finish-day-title" tabIndex={-1}>Today’s Summary</h1>
    <dl className="v2-day-totals">
      <div><dt>Total Stops</dt><dd>{workday.stops.length}</dd></div>
      <div><dt>Completed</dt><dd>{workday.stops.filter(stop => stop.state === "experience_published").length}</dd></div>
      <div><dt>Starting Odometer</dt><dd>{workday.equipment.odometer} MI</dd></div>
      <div>
        <dt>Ending Odometer</dt>
        {completed
          ? <dd>{workday.endingOdometer ? `${workday.endingOdometer} MI` : "Not recorded"}</dd>
          : <dd><input
              className="v2-ending-odometer-input"
              type="text"
              inputMode="numeric"
              aria-label="Ending odometer"
              placeholder="Not recorded"
              value={endingOdometerDraft}
              onChange={event => setEndingOdometerDraft(event.target.value)}
            /></dd>}
      </div>
      {miles !== null ? <div className="v2-total-miles"><dt>Total Miles</dt><dd>{miles} MI</dd></div> : null}
    </dl>
    <p>{completed ? "This completed route is retained in your summary." : "Check today’s completed stops, then finish your day."}</p>
    <h2 className="v2-shift-heading">Shift Summary</h2>
    <ol className="v2-finish-stops v2-shift-timeline">
      {startedAt ? <li className="v2-shift-anchor"><span aria-hidden="true" /><div><strong>Start</strong><small>Day opened</small></div><b>{startedAt}</b></li> : null}
      {workday.stops.map((stop, index) => {
        const arrived = formatClockTime(stop.arrivedAt);
        const departed = formatClockTime(stop.departedAt);
        const waited = stopWaitingMinutes(stop);
        return <li key={stop.id}>
          <span>{index + 1}</span>
          <div>
            <strong>{stop.displayName}</strong>
            <small>{stop.address}</small>
            {waited !== null ? <small className="v2-shift-waited">At stop {formatWaitingDuration(waited)}</small> : null}
          </div>
          <b>{arrived ? <>{arrived}{departed ? <><br />{departed}</> : null}</> : "Complete"}</b>
        </li>;
      })}
    </ol>
    {error ? <div className="v2-workflow-error" role="alert"><p>{error}</p>{error.toLowerCase().includes("sign in") || error.toLowerCase().includes("sign-in") ? <a href="/signin-with-chatgpt?return_to=%2F">Sign in again</a> : null}</div> : null}
    {completed ? <button className="v2-primary-button" type="button" onClick={onDismiss}>Close Summary</button> : <button className="v2-primary-button" type="button" disabled={status === "finishing"} onClick={() => void finish()}>{status === "finishing" ? "Finishing…" : status === "error" ? "Try Finishing Again" : "Finish Day"}</button>}
  </section>;
}
