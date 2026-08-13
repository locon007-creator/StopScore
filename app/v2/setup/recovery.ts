import { isCanonicalProviderId, validateEquipment, validateRoute, type Equipment, type RouteStopInput } from "../domain/workday.ts";
import { EQUIPMENT_FIELD_MAX_LENGTH, type EquipmentDraft, type SetupStage, type SetupState } from "./model.ts";

export const SETUP_DRAFT_KEY = "stopscore-v2-setup-draft";
export const DISMISSED_COMPLETED_KEY = "stopscore-v2-dismissed-completed";
export const SETUP_DRAFT_VERSION = 3 as const;
export const SETUP_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type PersistedSetupStage = Exclude<SetupStage, "stop-type" | "organize">;
export type PersistedSetupDraft = {
  version: typeof SETUP_DRAFT_VERSION;
  ownerId: string;
  savedAt: number;
  stage: PersistedSetupStage;
  equipmentDraft: EquipmentDraft;
  validatedEquipment: Equipment | null;
  committedStops: RouteStopInput[];
};

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function persistedStage(state: SetupState): PersistedSetupStage {
  if (state.stage === "stop-type") return "route-search";
  if (state.stage === "organize") return "route-list";
  return state.stage;
}

function normalizedOwnerId(value: string) {
  return value.trim().toLowerCase();
}

export function createPersistedSetupDraft(state: SetupState, ownerId: string, now = Date.now()): PersistedSetupDraft {
  return {
    version: SETUP_DRAFT_VERSION,
    ownerId: normalizedOwnerId(ownerId),
    savedAt: now,
    stage: persistedStage(state),
    equipmentDraft: { ...state.equipmentDraft },
    validatedEquipment: state.validatedEquipment ? { ...state.validatedEquipment } : null,
    committedStops: state.committedStops.map(stop => ({ ...stop })),
  };
}

export function restoreSetupState(draft: PersistedSetupDraft): SetupState {
  return {
    stage: draft.stage,
    equipmentDraft: { ...draft.equipmentDraft },
    equipmentErrors: {},
    validatedEquipment: draft.validatedEquipment ? { ...draft.validatedEquipment } : null,
    committedStops: draft.committedStops.map(stop => ({ ...stop })),
    organizingStops: [],
    routeError: null,
  };
}

const stages = new Set<PersistedSetupStage>(["equipment-choice", "trailer-choice", "equipment-info", "equipment-ready", "route-search", "route-list", "prepare"]);
const equipmentTypes = new Set(["tractor", "bobtail", "straight_truck", "box_truck", "small_box_truck", "cargo_van", null]);
const trailerTypes = new Set(["", "dry_van", "reefer", "flatbed", "step_deck", "tanker", "other"]);

function equipmentMatchesDraft(equipment: Equipment, draft: EquipmentDraft) {
  if (equipment.type !== draft.type || equipment.truckNumber !== draft.truckNumber.trim() || equipment.odometer !== draft.odometer.trim()) return false;
  if (equipment.type !== "tractor") return draft.trailerType === "" && draft.trailerNumber === "";
  return equipment.trailerType === draft.trailerType && equipment.trailerNumber === draft.trailerNumber.trim();
}

function parseDraft(value: unknown, ownerId: string, now: number): PersistedSetupDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.version !== SETUP_DRAFT_VERSION || typeof input.savedAt !== "number" || !Number.isFinite(input.savedAt)) return null;
  if (typeof input.ownerId !== "string" || normalizedOwnerId(input.ownerId) !== normalizedOwnerId(ownerId)) return null;
  if (input.savedAt > now || now - input.savedAt > SETUP_DRAFT_TTL_MS) return null;
  if (typeof input.stage !== "string" || !stages.has(input.stage as PersistedSetupStage)) return null;
  if (!input.equipmentDraft || typeof input.equipmentDraft !== "object" || Array.isArray(input.equipmentDraft)) return null;
  const rawEquipment = input.equipmentDraft as Record<string, unknown>;
  if (!equipmentTypes.has(rawEquipment.type as never)) return null;
  if (typeof rawEquipment.truckNumber !== "string" || typeof rawEquipment.odometer !== "string" || typeof rawEquipment.trailerNumber !== "string" || !trailerTypes.has(rawEquipment.trailerType as never)) return null;
  if ([rawEquipment.truckNumber, rawEquipment.odometer, rawEquipment.trailerNumber].some(value => (value as string).trim().length > EQUIPMENT_FIELD_MAX_LENGTH)) return null;
  if (rawEquipment.type !== "tractor" && (rawEquipment.trailerType !== "" || rawEquipment.trailerNumber !== "")) return null;
  const equipmentDraft = rawEquipment as EquipmentDraft;
  let validatedEquipment: Equipment | null = null;
  if (input.validatedEquipment !== null) {
    try { validatedEquipment = validateEquipment(input.validatedEquipment); } catch { return null; }
    if (!equipmentMatchesDraft(validatedEquipment, equipmentDraft)) return null;
  }
  const stage = input.stage as PersistedSetupStage;
  if (stage.startsWith("route") || stage === "prepare") {
    if (!validatedEquipment) return null;
  }
  if (!Array.isArray(input.committedStops)) return null;
  let committedStops: RouteStopInput[] = [];
  if (input.committedStops.length > 0) {
    try { committedStops = validateRoute(input.committedStops); } catch { return null; }
  }
  if ((stage === "route-list" || stage === "prepare") && committedStops.length === 0) return null;
  if (committedStops.some(stop => !isCanonicalProviderId(stop.providerId))) return null;
  return { version: SETUP_DRAFT_VERSION, ownerId: normalizedOwnerId(input.ownerId), savedAt: input.savedAt, stage, equipmentDraft: { ...equipmentDraft }, validatedEquipment, committedStops };
}

export function loadSetupDraft(storage: StorageLike | null | undefined, ownerId: string, now = Date.now()): PersistedSetupDraft | null {
  if (!storage) return null;
  try {
    const serialized = storage.getItem(SETUP_DRAFT_KEY);
    if (!serialized) return null;
    const draft = parseDraft(JSON.parse(serialized) as unknown, ownerId, now);
    if (!draft) storage.removeItem(SETUP_DRAFT_KEY);
    return draft;
  } catch {
    try { storage.removeItem(SETUP_DRAFT_KEY); } catch { /* storage is unavailable */ }
    return null;
  }
}

export function saveSetupDraft(storage: Pick<StorageLike, "setItem"> | null | undefined, draft: PersistedSetupDraft): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SETUP_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearSetupDraft(storage: Pick<StorageLike, "removeItem"> | null | undefined): void {
  try { storage?.removeItem(SETUP_DRAFT_KEY); } catch { /* storage is unavailable */ }
}

type ServerAuthority = { id: string; state: "setup" | "active" | "completed" };
export function resolveSetupAuthority<T extends ServerAuthority>(input: {
  server: T | null;
  draft: PersistedSetupDraft | null;
  dismissedCompletedId: string | null;
}) {
  if (input.server && (input.server.state !== "completed" || input.server.id !== input.dismissedCompletedId)) {
    return { source: "server" as const, aggregate: input.server, clearDraft: true };
  }
  if (input.draft) return { source: "draft" as const, draft: input.draft, clearDraft: false };
  return { source: "home" as const, clearDraft: false };
}
