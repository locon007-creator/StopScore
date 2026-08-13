"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { ArrowLeft, CheckCircle, Gauge } from "@phosphor-icons/react";
import type { BathroomCondition, ExperienceInput, ExperienceTopicKey, WorkdayAggregate, WorkdayStop } from "../domain/workday.ts";
import { EXPERIENCE_CARD_DEFINITIONS, WAITING_OPTIONS, createExperiencePublishSession, createExperienceState, reduceExperienceState, setBathroomResponse, setExperienceScore, setWaitingCategory, validateExperienceDraft } from "../workflow/experience.ts";
import { clearExperienceRecovery, createExperienceRecoveryRecord, loadExperienceRecovery, saveExperienceRecovery } from "../workflow/experience-recovery.ts";

const scoreLabels = ["Very Bad", "Bad", "Okay", "Good", "Excellent"] as const;
const makeKey = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `experience-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const storage = () => { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } };

function ScoreGauge({ name, legend, selected, onSelect }: { name: ExperienceTopicKey; legend: string; selected: number | undefined; onSelect: (score: number) => void }) {
  return <fieldset className="v2-score-fieldset">
    <legend>{legend}</legend>
    <div>{scoreLabels.map((label, index) => { const score = index + 1; return <label key={score} className={`score-${score}`}><input type="radio" name={name} value={score} checked={selected === score} onChange={() => onSelect(score)} /><span><strong>{score}</strong><small className="v2-score-name">{label}</small></span></label>; })}</div>
    <div className="v2-score-endpoints" aria-hidden="true"><span>Very Bad</span><span>Excellent</span></div>
  </fieldset>;
}

export function ExperienceFlow({ workdayId, stop, onPublish }: { workdayId: string; stop: WorkdayStop; onPublish: (stopId: string, input: ExperienceInput, key: string) => Promise<WorkdayAggregate> }) {
  const [recovery] = useState(() => loadExperienceRecovery(storage(), workdayId, stop.id));
  const [experience, dispatch] = useReducer(reduceExperienceState, undefined, () => ({ ...createExperienceState(stop.id), draft: recovery?.draft ?? createExperienceState(stop.id).draft }));
  const [cardIndex, setCardIndex] = useState(0);
  const [session] = useState(() => createExperiencePublishSession({ stopId: stop.id, keyFactory: () => recovery?.idempotencyKey ?? makeKey(), publish: onPublish }));
  const heading = useRef<HTMLHeadingElement>(null);
  const publishStep = cardIndex === EXPERIENCE_CARD_DEFINITIONS.length;
  const card = EXPERIENCE_CARD_DEFINITIONS[Math.min(cardIndex, EXPERIENCE_CARD_DEFINITIONS.length - 1)];

  useEffect(() => { heading.current?.focus(); }, [cardIndex]);
  useEffect(() => {
    saveExperienceRecovery(storage(), createExperienceRecoveryRecord({ workdayId, draft: experience.draft, idempotencyKey: session.idempotencyKey }));
  }, [experience.draft, session.idempotencyKey, workdayId]);
  const { draft, error, status } = experience;
  const setDraft = (next: typeof draft) => dispatch({ type: "replace-draft", draft: next });
  const setScore = (key: Exclude<ExperienceTopicKey, "bathroomAccess">, score: number) => {
    setDraft(setExperienceScore(draft, key, score));
    dispatch({ type: "clear-error" });
    setCardIndex(index => Math.min(index + 1, EXPERIENCE_CARD_DEFINITIONS.length));
  };
  const back = () => { dispatch({ type: "clear-error" }); setCardIndex(index => Math.max(0, index - 1)); };
  const publish = async () => {
    const validation = validateExperienceDraft(draft);
    if (!validation.ok) {
      dispatch({ type: "publish-failure", message: validation.message });
      setCardIndex(EXPERIENCE_CARD_DEFINITIONS.findIndex(item => item.key === validation.firstKey));
      return;
    }
    dispatch({ type: "publish-start" });
    try {
      await session.publish(validation.input);
      clearExperienceRecovery(storage(), workdayId, stop.id);
    } catch (cause) {
      dispatch({ type: "publish-failure", message: cause instanceof Error ? cause.message : "We couldn’t publish your Stop Knowledge. Your answers are saved here." });
    }
  };

  const headingId = publishStep ? `experience-${stop.id}-publish` : `experience-${stop.id}-${card.key}`;
  return <section className="v2-experience-flow" aria-labelledby={headingId}>
    <header className="v2-experience-header">
      <button type="button" aria-label="Previous experience topic" disabled={cardIndex === 0} onClick={back}><ArrowLeft aria-hidden="true" /></button>
      <p>{publishStep ? "Ready to publish" : "Share your experience"}</p>
      <span aria-hidden="true" />
    </header>

    {!publishStep ? <div className="v2-experience-card">
      <p className="v2-experience-count">{cardIndex + 1} of {EXPERIENCE_CARD_DEFINITIONS.length}</p>
      <div className="v2-topic-symbol" aria-hidden="true"><Gauge weight="duotone" /></div>
      <h1 ref={heading} tabIndex={-1} id={headingId}>{card.label}</h1>

      {(["yard", "staging", "staff"] as ExperienceTopicKey[]).includes(card.key) ? <ScoreGauge name={card.key} legend="Choose a score from 1 to 5" selected={draft.scores[card.key]} onSelect={score => setScore(card.key as "yard" | "staging" | "staff", score)} /> : null}
      {card.key === "bathroomAccess" ? <>
        <fieldset className="v2-choice-fieldset"><legend>Was a bathroom available?</legend><div><label><input type="radio" name="bathroom-answer" checked={draft.bathroomAnswer === "yes"} onChange={() => setDraft(setBathroomResponse(draft, "yes"))} /><span>Yes</span></label><label><input type="radio" name="bathroom-answer" checked={draft.bathroomAnswer === "no"} onChange={() => { setDraft(setBathroomResponse(draft, "no")); setCardIndex(EXPERIENCE_CARD_DEFINITIONS.length); }} /><span>No</span></label></div></fieldset>
        {draft.bathroomAnswer === "no" ? <p className="v2-bathroom-result">No bathroom access</p> : null}
        {draft.bathroomAnswer === "yes" ? <fieldset className="v2-choice-fieldset"><legend>Bathroom condition</legend><div>{([['clean', 'Clean'], ['dirty', 'Dirty'], ['needs_improvement', 'Needs improvement']] as const).map(([value, label]) => <label key={value}><input type="radio" name="bathroom-condition" checked={draft.bathroomCondition === value} onChange={() => { setDraft(setBathroomResponse(draft, "yes", value as BathroomCondition)); setCardIndex(EXPERIENCE_CARD_DEFINITIONS.length); }} /><span>{label}</span></label>)}</div></fieldset> : null}
      </> : null}

      {card.key === "waitingTime" ? <fieldset className="v2-waiting-fieldset"><legend>Waiting category</legend><div>{WAITING_OPTIONS.map(option => <label key={option.value}><input type="radio" name="waiting-category" checked={draft.waitingCategory === option.value} onChange={() => { setDraft(setWaitingCategory(draft, option.value)); setCardIndex(4); }} /><span><strong>{option.label} Wait</strong><small>{option.meaning}</small></span></label>)}</div></fieldset> : null}

    </div> : <div className="v2-experience-card v2-publish-card"><div className="v2-topic-symbol"><CheckCircle aria-hidden="true" weight="duotone" /></div><h1 ref={heading} tabIndex={-1} id={headingId}>Ready to Publish</h1><p className="v2-experience-question">Check the five completed topics for {stop.displayName}.</p><ol>{EXPERIENCE_CARD_DEFINITIONS.map(topic => <li key={topic.key}><span>{topic.label}</span><strong>{topic.key === "waitingTime" ? WAITING_OPTIONS.find(option => option.value === draft.waitingCategory)?.label : topic.key === "bathroomAccess" ? (draft.bathroomAnswer === "no" ? "No access" : draft.bathroomCondition?.replace("_", " ")) : `${draft.scores[topic.key] ?? "—"} / 5`}</strong></li>)}</ol></div>}

    {error ? <div className="v2-workflow-error" role="alert"><p>{error}</p>{error.toLowerCase().includes("sign in") || error.toLowerCase().includes("sign-in") ? <a href="/signin-with-chatgpt?return_to=%2F">Sign in again</a> : null}</div> : null}
    <div className="v2-experience-actions">
      {publishStep ? <button className="v2-primary-button" type="button" disabled={status === "publishing"} onClick={() => void publish()}>{status === "publishing" ? "Publishing…" : status === "error" ? "Try Publishing Again" : "Publish Experience"}</button> : null}
    </div>
  </section>;
}
