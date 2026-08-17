export const EQUIPMENT_TYPES = ["tractor", "bobtail", "straight_truck", "box_truck", "small_box_truck", "cargo_van"] as const;
export const TRACTOR_TRAILER_TYPES = ["dry_van", "reefer", "flatbed", "step_deck", "tanker", "other"] as const;
export const STOP_TYPES = ["delivery", "pickup", "drop_hook", "delivery_pickup"] as const;
export const EXPERIENCE_TOPICS = [
  { key: "yard", label: "Yard Experience" },
  { key: "staging", label: "Staging" },
  { key: "staff", label: "Staff Experience" },
  { key: "waitingTime", label: "Waiting Time" },
  { key: "bathroomAccess", label: "Bathroom Access" },
] as const;
export const WAITING_CATEGORIES = ["quick", "standard", "long", "extremely_delayed"] as const;
export const WORKDAY_STATES = ["setup", "active", "completed"] as const;
export const STOP_STATES = ["pending", "navigating", "arrived", "departed", "experience_published"] as const;
export const STOP_ACTIONS = ["navigate", "arrive", "depart"] as const;

export type EquipmentType = typeof EQUIPMENT_TYPES[number];
export type TrailerType = typeof TRACTOR_TRAILER_TYPES[number];
export type StopType = typeof STOP_TYPES[number];
export type ExperienceTopicKey = typeof EXPERIENCE_TOPICS[number]["key"];
export type WaitingCategory = typeof WAITING_CATEGORIES[number];
export type BathroomCondition = "clean" | "dirty" | "needs_improvement";
export type WorkdayState = typeof WORKDAY_STATES[number];
export type StopState = typeof STOP_STATES[number];
export type StopAction = typeof STOP_ACTIONS[number];

export type Equipment = {
  type: EquipmentType;
  truckNumber: string;
  trailerNumber?: string;
  trailerType?: TrailerType;
  odometer: string;
};

export type RouteStopInput = {
  providerId: string;
  displayName: string;
  address: string;
  type: StopType;
  order: number;
};

/**
 * Times recorded when the driver pressed each Work Mode action. These are
 * derived from the `v2_stop_events` log rather than stored on the stop row, so
 * they are optional: aggregates produced before event replay was surfaced, and
 * stops that have not reached a given state, simply omit the field.
 */
export type StopTimestamps = {
  navigatedAt?: string;
  arrivedAt?: string;
  departedAt?: string;
};

export type WorkdayStop = RouteStopInput & {
  id: string;
  state: StopState;
} & StopTimestamps;

export type WorkdayAggregate = {
  id: string;
  state: WorkdayState;
  activeStopIndex: number;
  equipment: Equipment;
  stops: WorkdayStop[];
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
};

export type ExperienceScores = Record<ExperienceTopicKey, number>;

export type ExperienceInput = {
  scores: ExperienceScores;
  waitingCategory: WaitingCategory;
  bathroom: {
    available: boolean;
    condition: BathroomCondition | null;
  };
};

export class ValidationError extends Error {
  readonly code = "validation";

  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class MissingError extends Error {
  readonly code = "missing";

  constructor(message: string) {
    super(message);
    this.name = "MissingError";
  }
}

export class ConflictError extends Error {
  readonly code = "conflict";

  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

const canonicalProviderId = /^osm:(?:node|way|relation):[1-9]\d*$/;

function requireBoundedText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string") throw new ValidationError(`${label} is required.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new ValidationError(`${label} is invalid.`);
  return normalized;
}

export function isCanonicalProviderId(value: unknown): value is string {
  return typeof value === "string" && canonicalProviderId.test(value);
}

export function validateEquipment(value: unknown): Equipment {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Equipment is required.");
  }
  const input = value as Record<string, unknown>;
  if (typeof input.type !== "string" || !EQUIPMENT_TYPES.includes(input.type as EquipmentType)) {
    throw new ValidationError("Equipment type is invalid.");
  }
  const type = input.type as EquipmentType;
  const equipment: Equipment = {
    type,
    truckNumber: requireBoundedText(input.truckNumber, "Truck number", 80),
    odometer: requireBoundedText(input.odometer, "Odometer", 80),
  };

  if (type === "tractor") {
    if (input.trailerNumber !== undefined && input.trailerNumber !== "") {
      equipment.trailerNumber = requireBoundedText(input.trailerNumber, "Trailer number", 80);
    }
    if (typeof input.trailerType !== "string" || !TRACTOR_TRAILER_TYPES.includes(input.trailerType as TrailerType)) {
      throw new ValidationError("Trailer type is invalid.");
    }
    equipment.trailerType = input.trailerType as TrailerType;
  } else if (input.trailerNumber !== undefined || input.trailerType !== undefined) {
    throw new ValidationError("Trailer information is only valid for a tractor.");
  }

  return equipment;
}

export function validateRoute(value: unknown): RouteStopInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
    throw new ValidationError("A route must contain between 1 and 100 stops.");
  }
  const providerIds = new Set<string>();
  const stops = value.map((entry, index): RouteStopInput => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ValidationError("Route stop is invalid.");
    }
    const stop = entry as Record<string, unknown>;
    if (!isCanonicalProviderId(stop.providerId)) {
      throw new ValidationError("Provider identity is invalid.");
    }
    if (providerIds.has(stop.providerId)) {
      throw new ValidationError("A route cannot contain the same place twice.");
    }
    providerIds.add(stop.providerId);
    if (stop.order !== index) throw new ValidationError("Route order must be contiguous and zero-based.");
    if (typeof stop.type !== "string" || !STOP_TYPES.includes(stop.type as StopType)) {
      throw new ValidationError("Stop type is invalid.");
    }
    return {
      providerId: stop.providerId,
      displayName: requireBoundedText(stop.displayName, "Stop name", 160),
      address: requireBoundedText(stop.address, "Stop address", 400),
      type: stop.type as StopType,
      order: index,
    };
  });
  return stops;
}

export function validateExperience(value: unknown): ExperienceInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Experience is required.");
  }
  const input = value as Record<string, unknown>;
  const scores = input.scores;
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
    throw new ValidationError("Experience scores are required.");
  }
  const scoreRecord = scores as Record<string, unknown>;
  const exactKeys = Object.keys(scoreRecord);
  if (exactKeys.length !== EXPERIENCE_TOPICS.length || EXPERIENCE_TOPICS.some(topic => !exactKeys.includes(topic.key))) {
    throw new ValidationError("All five experience scores are required.");
  }
  const normalizedScores = {} as ExperienceScores;
  for (const topic of EXPERIENCE_TOPICS) {
    const score = scoreRecord[topic.key];
    if (!Number.isInteger(score) || (score as number) < 1 || (score as number) > 5) {
      throw new ValidationError("Experience scores must be whole numbers from 1 through 5.");
    }
    normalizedScores[topic.key] = score as number;
  }
  if (typeof input.waitingCategory !== "string" || !WAITING_CATEGORIES.includes(input.waitingCategory as WaitingCategory)) {
    throw new ValidationError("Waiting category is invalid.");
  }
  if (!input.bathroom || typeof input.bathroom !== "object" || Array.isArray(input.bathroom)) {
    throw new ValidationError("Bathroom access is required.");
  }
  const bathroom = input.bathroom as Record<string, unknown>;
  if (typeof bathroom.available !== "boolean") throw new ValidationError("Bathroom availability is invalid.");
  const conditions = ["clean", "dirty", "needs_improvement"] as const;
  if (bathroom.available && (typeof bathroom.condition !== "string" || !conditions.includes(bathroom.condition as BathroomCondition))) {
    throw new ValidationError("Bathroom condition is required when a bathroom is available.");
  }
  if (!bathroom.available && bathroom.condition !== null) {
    throw new ValidationError("Bathroom condition must be empty when no bathroom is available.");
  }
  return {
    scores: normalizedScores,
    waitingCategory: input.waitingCategory as WaitingCategory,
    bathroom: { available: bathroom.available, condition: bathroom.condition as BathroomCondition | null },
  };
}

export function transitionStop(state: StopState, action: StopAction): StopState {
  const allowed: Record<StopAction, readonly [StopState, StopState]> = {
    navigate: ["pending", "navigating"],
    arrive: ["navigating", "arrived"],
    depart: ["arrived", "departed"],
  };
  const [expected, next] = allowed[action];
  if (state !== expected) throw new ConflictError(`Cannot ${action} a stop in ${state} state.`);
  return next;
}

export function markExperiencePublished(state: StopState): StopState {
  if (state !== "departed") throw new ConflictError(`Cannot publish experience for a stop in ${state} state.`);
  return "experience_published";
}

export function advanceAfterExperience<T extends WorkdayAggregate>(aggregate: T, stopId: string): T {
  const stopIndex = aggregate.stops.findIndex(stop => stop.id === stopId);
  if (stopIndex < 0) throw new MissingError("Stop not found.");
  if (stopIndex !== aggregate.activeStopIndex) throw new ConflictError("This is not the active stop.");
  const stops = aggregate.stops.map(stop => stop.id === stopId
    ? { ...stop, state: markExperiencePublished(stop.state) }
    : { ...stop });
  return {
    ...aggregate,
    activeStopIndex: stopIndex + 1,
    stops,
  } as T;
}

export function completeAggregate<T extends WorkdayAggregate>(aggregate: T): T {
  if (aggregate.state !== "active" || aggregate.stops.some(stop => stop.state !== "experience_published")) {
    throw new ConflictError("Every stop experience must be published before finishing the workday.");
  }
  return { ...aggregate, state: "completed", activeStopIndex: aggregate.stops.length } as T;
}
