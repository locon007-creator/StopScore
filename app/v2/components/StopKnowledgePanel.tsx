"use client";

import { useEffect, useState } from "react";
import { Gauge, X } from "@phosphor-icons/react";
import { EXPERIENCE_TOPICS, type StopKnowledgeSummary, type WorkdayStop } from "../domain/workday.ts";
import { formatUpdatedLabel } from "../workflow/model.ts";

async function defaultLoadKnowledge(stopId: string): Promise<StopKnowledgeSummary | null> {
  const response = await fetch(`/api/v2/stops/${encodeURIComponent(stopId)}/experience`, { headers: { Accept: "application/json" } });
  const body = await response.json() as { knowledge?: StopKnowledgeSummary | null; error?: { message?: string } | string };
  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : body.error?.message;
    throw new Error(message || "Stop Knowledge is unavailable.");
  }
  return body.knowledge ?? null;
}

/**
 * Never blocks Work Mode: this is an overlay opened on demand, and a fetch failure here shows an
 * inline message the driver can dismiss rather than anything that stops them from working the
 * stop. "No experience yet" and "the request failed" are deliberately different messages, since
 * only one of them is worth retrying.
 */
export function StopKnowledgePanel({ stop, onClose, loadKnowledge = defaultLoadKnowledge }: {
  stop: WorkdayStop;
  onClose: () => void;
  loadKnowledge?: (stopId: string) => Promise<StopKnowledgeSummary | null>;
}) {
  const [knowledge, setKnowledge] = useState<StopKnowledgeSummary | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setKnowledge(undefined);
    setError(null);
    void loadKnowledge(stop.id)
      .then(value => { if (live) setKnowledge(value); })
      .catch(cause => { if (live) setError(cause instanceof Error ? cause.message : "Stop Knowledge is unavailable."); });
    return () => { live = false; };
  }, [loadKnowledge, stop.id]);

  return <section className="v2-knowledge-panel" role="dialog" aria-modal="true" aria-labelledby="knowledge-title">
    <header><div><p className="v2-eyebrow">{stop.displayName}</p><h2 id="knowledge-title">Stop Knowledge</h2><p>{stop.address}</p></div><button className="v2-icon-button" type="button" aria-label="Close Stop Knowledge" onClick={onClose}><X aria-hidden="true" /></button></header>

    {error ? <div className="v2-inline-error" role="alert"><p>{error}</p></div> : null}

    {knowledge === undefined && !error ? <p className="v2-search-status" role="status">Loading Stop Knowledge…</p> : null}

    {knowledge === null && !error ? <div className="v2-knowledge-empty"><Gauge aria-hidden="true" weight="duotone" /><strong>No StopScore yet</strong><p>No shared experience has been published for this stop yet.</p></div> : null}

    {knowledge ? <div className="v2-knowledge-summary">
      <div className="v2-overall-score"><strong>{knowledge.overallScore}</strong><span>STOP SCORE</span></div>
      <p className="v2-knowledge-meta">{knowledge.experienceCount} {knowledge.experienceCount === 1 ? "Experience" : "Experiences"} &middot; {formatUpdatedLabel(knowledge.updatedAt)}</p>
    </div> : null}

    <ol>{EXPERIENCE_TOPICS.map(topic => <li key={topic.key}><span>{topic.label}</span>{knowledge ? <strong>{knowledge.topicScores[topic.key]}</strong> : <small>No data yet</small>}</li>)}</ol>

    <section className="v2-driver-comments">
      <h3>Driver Comments</h3>
      {knowledge && knowledge.comments.length
        ? <ul>{knowledge.comments.map((comment, index) => <li key={index}>{comment}</li>)}</ul>
        : <p>No driver comments yet.</p>}
    </section>
  </section>;
}
