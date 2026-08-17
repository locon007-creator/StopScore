import type { BathroomCondition, ExperienceInput, ExperienceScores, ExperienceTopicKey, WaitingCategory, WorkdayAggregate } from "../domain/workday.ts";
import { EXPERIENCE_TOPICS } from "../domain/workday.ts";

export const EXPERIENCE_CARD_DEFINITIONS = EXPERIENCE_TOPICS;
export const WAITING_OPTIONS = [
  { value: "quick", label: "Quick", meaning: "15–45 min" },
  { value: "standard", label: "Standard", meaning: "30 min–1 hr" },
  { value: "long", label: "Long", meaning: "1–2 hr" },
  { value: "extremely_delayed", label: "Extremely Delayed", meaning: "2+ hr" },
] as const satisfies ReadonlyArray<{ value: WaitingCategory; label: string; meaning: string }>;

export type BathroomAnswer = "yes" | "no";
export type ExperienceDraft = {
  stopId: string;
  scores: Partial<ExperienceScores>;
  waitingCategory: WaitingCategory | null;
  bathroomAnswer: BathroomAnswer | null;
  bathroomCondition: BathroomCondition | null;
};

export type ExperienceValidation =
  | { ok: true; input: ExperienceInput; summary: string }
  | { ok: false; message: string; firstKey: ExperienceTopicKey };

export type ExperienceStatus = "idle" | "publishing" | "error";

export type ExperienceState = {
  draft: ExperienceDraft;
  status: ExperienceStatus;
  error: string | null;
};

export type ExperienceAction =
  | { type: "replace-draft"; draft: ExperienceDraft }
  | { type: "clear-error" }
  | { type: "publish-start" }
  | { type: "publish-failure"; message: string };

const WAITING_SCORES = {
  quick: 5,
  standard: 4,
  long: 2,
  extremely_delayed: 1,
} as const satisfies Record<WaitingCategory, number>;

const BATHROOM_CONDITION_SCORES = {
  clean: 5,
  needs_improvement: 3,
  dirty: 2,
} as const satisfies Record<BathroomCondition, number>;

const BATHROOM_CONDITION_LABELS = {
  clean: "Clean",
  dirty: "Dirty",
  needs_improvement: "Needs improvement",
} as const satisfies Record<BathroomCondition, string>;

const NO_BATHROOM_SCORE = 1;
const NO_BATHROOM_SUMMARY = "No bathroom access";

/** The waiting category and the bathroom answer own their derived scores. */
export function waitingScore(category: WaitingCategory): number {
  return WAITING_SCORES[category];
}

export function bathroomScore(answer: BathroomAnswer, condition: BathroomCondition | null): number {
  return answer === "no" || condition === null ? NO_BATHROOM_SCORE : BATHROOM_CONDITION_SCORES[condition];
}

export function createExperienceDraft(stopId: string): ExperienceDraft {
  return { stopId, scores: {}, waitingCategory: null, bathroomAnswer: null, bathroomCondition: null };
}

function requireIntegerScore(score: number): number {
  if (!Number.isInteger(score)) throw new Error("An experience score must be a whole number from 1 through 5.");
  if (score < 1 || score > 5) throw new Error("An experience score must be a whole number from 1 through 5.");
  return score;
}

export function setExperienceScore(draft: ExperienceDraft, key: ExperienceTopicKey, score: number): ExperienceDraft {
  return { ...draft, scores: { ...draft.scores, [key]: requireIntegerScore(score) } };
}

export function setWaitingCategory(draft: ExperienceDraft, category: WaitingCategory): ExperienceDraft {
  return { ...draft, waitingCategory: category, scores: { ...draft.scores, waitingTime: waitingScore(category) } };
}

export function setBathroomResponse(draft: ExperienceDraft, answer: BathroomAnswer, condition: BathroomCondition | null = null): ExperienceDraft {
  const resolvedCondition = answer === "yes" ? condition : null;
  return {
    ...draft,
    bathroomAnswer: answer,
    bathroomCondition: resolvedCondition,
    scores: { ...draft.scores, bathroomAccess: bathroomScore(answer, resolvedCondition) },
  };
}

/** Kept separate so a recovered or manually adjusted gauge cannot silently change the persisted answer. */
export function setBathroomScore(draft: ExperienceDraft, score: number): ExperienceDraft {
  return { ...draft, scores: { ...draft.scores, bathroomAccess: requireIntegerScore(score) } };
}

function invalid(message: string, firstKey: ExperienceTopicKey): ExperienceValidation {
  return { ok: false, message, firstKey };
}

export function validateExperienceDraft(draft: ExperienceDraft): ExperienceValidation {
  for (const topic of EXPERIENCE_CARD_DEFINITIONS) {
    if (topic.key === "waitingTime") {
      if (draft.waitingCategory === null) return invalid("Choose how long you waited.", "waitingTime");
      continue;
    }
    if (topic.key === "bathroomAccess") continue;
    const score = draft.scores[topic.key];
    if (score === undefined) return invalid(`Choose a score for ${topic.label}.`, topic.key);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return invalid(`${topic.label} must be a whole number from 1 through 5.`, topic.key);
    }
  }

  if (draft.bathroomAnswer === null) return invalid("Choose Yes or No for bathroom availability.", "bathroomAccess");
  if (draft.bathroomAnswer === "no" && draft.bathroomCondition !== null) {
    return invalid("Bathroom condition must be empty when no bathroom is available.", "bathroomAccess");
  }
  if (draft.bathroomAnswer === "yes" && draft.bathroomCondition === null) {
    return invalid("Choose the bathroom condition.", "bathroomAccess");
  }

  const waitingCategory = draft.waitingCategory as WaitingCategory;
  const available = draft.bathroomAnswer === "yes";
  const condition = available ? draft.bathroomCondition : null;
  const scores: ExperienceScores = {
    yard: draft.scores.yard as number,
    staging: draft.scores.staging as number,
    staff: draft.scores.staff as number,
    waitingTime: draft.scores.waitingTime ?? waitingScore(waitingCategory),
    bathroomAccess: draft.scores.bathroomAccess ?? bathroomScore(draft.bathroomAnswer, condition),
  };

  return {
    ok: true,
    input: { scores, waitingCategory, bathroom: { available, condition } },
    summary: available && condition ? BATHROOM_CONDITION_LABELS[condition] : NO_BATHROOM_SUMMARY,
  };
}

export function createExperienceState(stopId: string): ExperienceState {
  return { draft: createExperienceDraft(stopId), status: "idle", error: null };
}

/** A failed publish must never discard the driver's answers. */
export function reduceExperienceState(state: ExperienceState, action: ExperienceAction): ExperienceState {
  switch (action.type) {
    case "replace-draft":
      return { ...state, draft: action.draft, status: state.status === "publishing" ? state.status : "idle", error: null };
    case "clear-error":
      return state.error === null ? state : { ...state, error: null };
    case "publish-start":
      return { ...state, status: "publishing", error: null };
    case "publish-failure":
      return { ...state, status: "error", error: action.message };
    default:
      return state;
  }
}

export type ExperiencePublishSession = {
  readonly stopId: string;
  readonly idempotencyKey: string;
  publish: (input: ExperienceInput) => Promise<WorkdayAggregate>;
};

/**
 * One stop earns exactly one publish identity. The key is minted once per session so a
 * retry after a lost response replays the same logical write instead of duplicating it.
 */
export function createExperiencePublishSession(dependencies: {
  stopId: string;
  keyFactory: () => string;
  publish: (stopId: string, input: ExperienceInput, key: string) => Promise<WorkdayAggregate>;
}): ExperiencePublishSession {
  const { stopId, keyFactory, publish } = dependencies;
  const idempotencyKey = keyFactory();
  return {
    stopId,
    idempotencyKey,
    publish: (input: ExperienceInput) => publish(stopId, input, idempotencyKey),
  };
}
