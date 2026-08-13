"use client";

import { useState } from "react";
import { CheckCircle, House, Info } from "@phosphor-icons/react";
import type { WorkdayAggregate } from "../domain/workday.ts";

export function FinishDay({ workday, onFinish, onDismiss }: { workday: WorkdayAggregate; onFinish: (workdayId: string) => Promise<WorkdayAggregate>; onDismiss: () => void }) {
  const [status, setStatus] = useState<"idle" | "finishing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const completed = workday.state === "completed";
  const [step, setStep] = useState<"home-base" | "summary">(completed ? "summary" : "home-base");
  const finish = async () => {
    setStatus("finishing"); setError(null);
    try { await onFinish(workday.id); }
    catch (cause) { setStatus("error"); setError(cause instanceof Error ? cause.message : "We couldn’t finish your workday. Try again."); }
  };
  if (step === "home-base") return <section className="v2-finish-day v2-home-base" aria-labelledby="home-base-title">
    <div className="v2-work-progress"><span>Route complete</span><div className="v2-street-progress" aria-hidden="true"><i className="v2-progress-road" />{workday.stops.map(stop => <i key={stop.id} className="v2-progress-marker complete" />)}<CheckCircle className="v2-progress-finish" weight="fill" /></div></div>
    <div className="v2-status-mark" aria-hidden="true"><House weight="duotone" /></div><p className="v2-eyebrow">All stops complete</p><h1 id="home-base-title">Proceed to Home Base</h1>
    <div className="v2-home-base-card"><House aria-hidden="true" weight="duotone" /><strong>Home Base</strong><p>Home Base address is not set.</p></div>
    <div className="v2-navigation-boundary"><Info aria-hidden="true" weight="fill" /><p>Set a verified Home Base before navigation can open safely. StopScore will not guess an address.</p></div>
    <button className="v2-primary-button" type="button" onClick={() => setStep("summary")}>Continue to Day Summary</button>
  </section>;
  return <section className="v2-finish-day" aria-labelledby="finish-day-title">
    <div className="v2-status-mark" aria-hidden="true"><CheckCircle weight="duotone" /></div><p className="v2-eyebrow">{completed ? "Workday complete" : "Route complete"}</p>
    <h1 id="finish-day-title" tabIndex={-1}>Today’s Summary</h1>
    <dl className="v2-day-totals"><div><dt>Total Stops</dt><dd>{workday.stops.length}</dd></div><div><dt>Completed</dt><dd>{workday.stops.filter(stop => stop.state === "experience_published").length}</dd></div><div><dt>Starting Odometer</dt><dd>{workday.equipment.odometer} MI</dd></div></dl>
    <p>{completed ? "This completed route is retained in your summary." : "Check today’s completed stops, then finish your day."}</p>
    <ol className="v2-finish-stops">{workday.stops.map((stop, index) => <li key={stop.id}><span>{index + 1}</span><div><strong>{stop.displayName}</strong><small>{stop.address}</small></div><b>Complete</b></li>)}</ol>
    {error ? <div className="v2-workflow-error" role="alert"><p>{error}</p>{error.toLowerCase().includes("sign in") || error.toLowerCase().includes("sign-in") ? <a href="/signin-with-chatgpt?return_to=%2F">Sign in again</a> : null}</div> : null}
    {completed ? <button className="v2-primary-button" type="button" onClick={onDismiss}>Close Summary</button> : <button className="v2-primary-button" type="button" disabled={status === "finishing"} onClick={() => void finish()}>{status === "finishing" ? "Finishing…" : status === "error" ? "Try Finishing Again" : "Finish Day"}</button>}
  </section>;
}
