"use client";

import { Gauge, X } from "@phosphor-icons/react";
import { EXPERIENCE_TOPICS, type WorkdayStop } from "../domain/workday.ts";

export function StopKnowledgePanel({ stop, onClose }: { stop: WorkdayStop; onClose: () => void }) {
  return <section className="v2-knowledge-panel" role="dialog" aria-modal="true" aria-labelledby="knowledge-title">
    <header><div><p className="v2-eyebrow">{stop.displayName}</p><h2 id="knowledge-title">Stop Knowledge</h2><p>{stop.address}</p></div><button className="v2-icon-button" type="button" aria-label="Close Stop Knowledge" onClick={onClose}><X aria-hidden="true" /></button></header>
    <div className="v2-knowledge-empty"><Gauge aria-hidden="true" weight="duotone" /><strong>No StopScore yet</strong><p>No shared experience has been published for this stop yet.</p></div>
    <ol>{EXPERIENCE_TOPICS.map(topic => <li key={topic.key}><span>{topic.label}</span><small>No data yet</small></li>)}</ol>
    <section className="v2-driver-comments"><h3>Driver Comments</h3><p>No driver comments yet.</p></section>
  </section>;
}
