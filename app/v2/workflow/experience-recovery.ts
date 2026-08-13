import { WAITING_CATEGORIES, type BathroomCondition, type ExperienceTopicKey, type WaitingCategory } from "../domain/workday.ts";
import type { BathroomAnswer, ExperienceDraft } from "./experience.ts";

export const EXPERIENCE_RECOVERY_VERSION = 1 as const;
const MAX_AGE = 24 * 60 * 60 * 1000;

export type ExperienceRecoveryRecord = {
  version: typeof EXPERIENCE_RECOVERY_VERSION;
  workdayId: string;
  stopId: string;
  savedAt: number;
  idempotencyKey: string;
  draft: ExperienceDraft;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const storageKey = (workdayId: string, stopId: string) => `stopscore:v2:experience:${workdayId}:${stopId}`;
const conditions = new Set<BathroomCondition>(["clean", "dirty", "needs_improvement"]);
const answers = new Set<BathroomAnswer>(["yes", "no"]);
const topics = new Set<ExperienceTopicKey>(["yard", "staging", "staff", "waitingTime", "bathroomAccess"]);

function isDraft(value: unknown, stopId: string): value is ExperienceDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Partial<ExperienceDraft>;
  if (draft.stopId !== stopId || !draft.scores || typeof draft.scores !== "object" || Array.isArray(draft.scores)) return false;
  const entries = Object.entries(draft.scores);
  if (entries.some(([key, score]) => !topics.has(key as ExperienceTopicKey) || !Number.isInteger(score) || (score as number) < 1 || (score as number) > 5)) return false;
  if (draft.waitingCategory !== null && !WAITING_CATEGORIES.includes(draft.waitingCategory as WaitingCategory)) return false;
  if (draft.bathroomAnswer !== null && !answers.has(draft.bathroomAnswer as BathroomAnswer)) return false;
  if (draft.bathroomCondition !== null && !conditions.has(draft.bathroomCondition as BathroomCondition)) return false;
  if (draft.bathroomAnswer === null && (draft.bathroomCondition !== null || "bathroomAccess" in draft.scores)) return false;
  if (draft.bathroomAnswer === "yes" && draft.bathroomCondition === null) return false;
  if (draft.bathroomAnswer === "no" && draft.bathroomCondition !== null) return false;
  return true;
}

function isRecord(value: unknown, workdayId: string, stopId: string, now: number): value is ExperienceRecoveryRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<ExperienceRecoveryRecord>;
  return record.version === EXPERIENCE_RECOVERY_VERSION
    && record.workdayId === workdayId
    && record.stopId === stopId
    && typeof record.savedAt === "number"
    && record.savedAt <= now
    && now - record.savedAt <= MAX_AGE
    && typeof record.idempotencyKey === "string"
    && record.idempotencyKey.length > 0
    && record.idempotencyKey.length <= 200
    && isDraft(record.draft, stopId);
}

export function createExperienceRecoveryRecord(input: { workdayId: string; draft: ExperienceDraft; idempotencyKey: string; now?: number }): ExperienceRecoveryRecord {
  return { version: EXPERIENCE_RECOVERY_VERSION, workdayId: input.workdayId, stopId: input.draft.stopId, savedAt: input.now ?? Date.now(), idempotencyKey: input.idempotencyKey, draft: input.draft };
}

export function saveExperienceRecovery(storage: StorageLike | null, record: ExperienceRecoveryRecord): boolean {
  try { storage?.setItem(storageKey(record.workdayId, record.stopId), JSON.stringify(record)); return Boolean(storage); } catch { return false; }
}

export function loadExperienceRecovery(storage: StorageLike | null, workdayId: string, stopId: string, now = Date.now()): ExperienceRecoveryRecord | null {
  try {
    const raw = storage?.getItem(storageKey(workdayId, stopId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed, workdayId, stopId, now)) { storage?.removeItem(storageKey(workdayId, stopId)); return null; }
    return parsed;
  } catch { return null; }
}

export function clearExperienceRecovery(storage: StorageLike | null, workdayId: string, stopId: string): void {
  try { storage?.removeItem(storageKey(workdayId, stopId)); } catch { /* recovery is best effort */ }
}
