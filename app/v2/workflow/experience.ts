import type { BathroomCondition, ExperienceInput, ExperienceScores, ExperienceTopicKey, WaitingCategory, WorkdayAggregate } from "../domain/workday.ts";
import { EXPERIENCE_TOPICS } from "../domain/workday.ts";

export const EXPERIENCE_CARD_DEFINITIONS = EXPERIENCE_TOPICS;
/**
 * Bands a measured wait falls into. They read as continuous ranges because the duration is timed
 * from Arrive to Depart, so every possible wait lands in exactly one band with no gap between
 * Quick and Standard.
 */
export const WAITING_OPTIONS = [
  { value: "quick", label: "Quick", meaning: "Under 45 min" },
  { value: "standard", label: "Standard", meaning: "45 min–2 hr" },
  { value: "long", label: "Long", meaning: "2–4 hr" },
  { value: "extremely_delayed", label: "Extremely Delayed", meaning: "4+ hr" },
] as const satisfies ReadonlyArray<{ value: WaitingCategory; label: string; meaning: string }>;

export type BathroomAnswer = "yes" | "no";
export type ExperienceDraft = {
  stopId: string;
  scores: Partial<ExperienceScores>;
  waitingCategory: WaitingCategory | null;
  bathroomAnswer: BathroomAnswer | null;
  bathroomCondition: BathroomCondition | null;
};

/**
 * A waiting category and a bathroom answer each carry an authoritative 1–5 score, so a driver
 * never scores the same fact twice. The scale reads Very Bad, Bad, Neutral, Good, Excellent;
 * four waiting categories map onto it without needing Neutral.
 */
export const WAITING_CATEGORY_SCORES = {
  quick: 5,
  standard: 4,
  long: 2,
  extremely_delayed: 1,
} as const satisfies Record<WaitingCategory, number>;

export const BATHROOM_CONDITION_SCORES = {
  clean: 5,
  needs_improvement: 3,
  dirty: 2,
} as const satisfies Record<BathroomCondition, number>;

const NO_BATHROOM_SCORE = 1;
const NO_BATHROOM_SUMMARY = "No bathroom access";

export const BATHROOM_CONDITION_LABELS = {
  clean: "Clean",
  dirty: "Dirty",
  needs_improvement: "Needs improvement",
} as const satisfies Record<BathroomCondition, string>;

function assertWholeScore(score: number): number {
  if (!Number.isInteger(score)) throw new Error(`A StopScore answer must be a whole number from 1 to 5. Received ${score}.`);
  if (score < 1 || score > 5) throw new Error(`A StopScore answer must be a whole number from 1 to 5. Received ${score}.`);
  return score;
}

export function createExperienceDraft(stopId: string): ExperienceDraft {
  return { stopId, scores: {}, waitingCategory: null, bathroomAnswer: null, bathroomCondition: null };
}

export function setExperienceScore(draft: ExperienceDraft, key: ExperienceTopicKey, score: number): ExperienceDraft {
  return { ...draft, scores: { ...draft.scores, [key]: assertWholeScore(score) } };
}

export function setWaitingCategory(draft: ExperienceDraft, category: WaitingCategory): ExperienceDraft {
  return {
    ...draft,
    waitingCategory: category,
    scores: { ...draft.scores, waitingTime: WAITING_CATEGORY_SCORES[category] },
  };
}

export function setBathroomResponse(draft: ExperienceDraft, answer: BathroomAnswer, condition?: BathroomCondition): ExperienceDraft {
  if (answer === "no") {
    return {
      ...draft,
      bathroomAnswer: "no",
      bathroomCondition: null,
      scores: { ...draft.scores, bathroomAccess: NO_BATHROOM_SCORE },
    };
  }
  if (!condition) {
    const scores = { ...draft.scores };
    delete scores.bathroomAccess;
    return { ...draft, bathroomAnswer: "yes", bathroomCondition: null, scores };
  }
  return {
    ...draft,
    bathroomAnswer: "yes",
    bathroomCondition: condition,
    scores: { ...draft.scores, bathroomAccess: BATHROOM_CONDITION_SCORES[condition] },
  };
}

export function setBathroomScore(draft: ExperienceDraft, score: number): ExperienceDraft {
  return { ...draft, scores: { ...draft.scores, bathroomAccess: assertWholeScore(score) } };
}

export type ExperienceValidation =
  | { ok: true; input: ExperienceInput; summary: string }
  | { ok: false; message: string; firstKey: ExperienceTopicKey };

export function validateExperienceDraft(draft: ExperienceDraft): ExperienceValidation {
  for (const topic of EXPERIENCE_CARD_DEFINITIONS) {
    if (topic.key === "waitingTime" && !draft.waitingCategory) {
      return { ok: false, message: "Choose how long the wait was before publishing.", firstKey: "waitingTime" };
    }
    if (topic.key === "bathroomAccess") {
      if (!draft.bathroomAnswer) {
        return { ok: false, message: "Choose Yes or No for bathroom availability.", firstKey: "bathroomAccess" };
      }
      if (draft.bathroomAnswer === "no" && draft.bathroomCondition) {
        return { ok: false, message: "Bathroom condition must be empty when no bathroom is available.", firstKey: "bathroomAccess" };
      }
      if (draft.bathroomAnswer === "yes" && !draft.bathroomCondition) {
        return { ok: false, message: "Choose the bathroom condition.", firstKey: "bathroomAccess" };
      }
    }
    if (typeof draft.scores[topic.key] !== "number") {
      return { ok: false, message: `Answer ${topic.label} before publishing.`, firstKey: topic.key };
    }
  }

  const available = draft.bathroomAnswer === "yes";
  const scores = { ...draft.scores } as ExperienceScores;
  return {
    ok: true,
    summary: available && draft.bathroomCondition ? BATHROOM_CONDITION_LABELS[draft.bathroomCondition] : NO_BATHROOM_SUMMARY,
    input: {
      scores,
      waitingCategory: draft.waitingCategory as WaitingCategory,
      bathroom: { available, condition: available ? draft.bathroomCondition : null },
    },
  };
}

export type ExperienceStatus = "idle" | "publishing" | "error";
export type ExperienceState = { stopId: string; draft: ExperienceDraft; status: ExperienceStatus; error: string | null };
export type ExperienceAction =
  | { type: "replace-draft"; draft: ExperienceDraft }
  | { type: "publish-start" }
  | { type: "publish-failure"; message: string }
  | { type: "clear-error" };

export function createExperienceState(stopId: string): ExperienceState {
  return { stopId, draft: createExperienceDraft(stopId), status: "idle", error: null };
}

/**
 * A failed publish keeps the exact draft the driver answered, so a retry never asks the five
 * questions again.
 */
export function reduceExperienceState(state: ExperienceState, action: ExperienceAction): ExperienceState {
  switch (action.type) {
    case "replace-draft":
      return { ...state, draft: action.draft, error: null };
    case "publish-start":
      return { ...state, status: "publishing", error: null };
    case "publish-failure":
      return { ...state, status: "error", error: action.message };
    case "clear-error":
      return state.error === null && state.status !== "error" ? state : { ...state, status: "idle", error: null };
    default:
      return state;
  }
}

export type ExperiencePublishSession = {
  readonly idempotencyKey: string;
  publish: (input: ExperienceInput) => Promise<WorkdayAggregate>;
};

/**
 * One idempotency key is minted per stop and reused for every retry, so a publish that failed
 * after the server accepted it can never create a second experience.
 */
export function createExperiencePublishSession(options: {
  stopId: string;
  keyFactory: () => string;
  publish: (stopId: string, input: ExperienceInput, key: string) => Promise<WorkdayAggregate>;
}): ExperiencePublishSession {
  const idempotencyKey = options.keyFactory();
  return {
    idempotencyKey,
    publish: (input: ExperienceInput) => options.publish(options.stopId, input, idempotencyKey),
  };
}
