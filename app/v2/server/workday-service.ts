import {
  STOP_ACTIONS,
  transitionStop,
  validateEquipment,
  validateExperience,
  validateRoute,
  ValidationError,
  type StopAction,
  type WorkdayAggregate,
} from "../domain/workday.ts";
import type { IdempotentWrite, WorkdayRepository } from "./workday-repository.ts";

type Dependencies = {
  ids: () => string;
  now: () => Date;
  dayDate: () => string;
};

const defaultDependencies: Dependencies = {
  ids: () => crypto.randomUUID(),
  now: () => new Date(),
  dayDate: () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  },
};

function driverIdentity(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 320) {
    throw new ValidationError("Driver identity is invalid.");
  }
  return value.trim().toLowerCase();
}

function idempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 200) {
    throw new ValidationError("An idempotency key is required.");
  }
  return value.trim();
}

function boundedId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 200) {
    throw new ValidationError(`${label} is invalid.`);
  }
  return value.trim();
}

export class WorkdayService {
  private readonly repository: WorkdayRepository;
  private readonly dependencies: Dependencies;

  constructor(
    repository: WorkdayRepository,
    dependencies: Dependencies = defaultDependencies,
  ) {
    this.repository = repository;
    this.dependencies = dependencies;
  }

  async getCurrent(driver: unknown) {
    return this.repository.getCurrent(driverIdentity(driver));
  }

  async start(driver: unknown, input: unknown, key: unknown) {
    const driverId = driverIdentity(driver);
    const write = this.write(driverId, key, "start:", input);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ValidationError("Workday input is invalid.");
    const body = input as Record<string, unknown>;
    const equipment = validateEquipment(body.equipment);
    const route = validateRoute(body.stops);
    write.operation = `start:${JSON.stringify({ equipment, stops: route })}`;
    const id = this.dependencies.ids();
    const now = write.now;
    const aggregate: WorkdayAggregate = {
      id,
      state: "active",
      activeStopIndex: 0,
      equipment,
      stops: route.map(stop => ({
        ...stop,
        id: `${id}:stop:${this.dependencies.ids()}`,
        state: "pending",
      })),
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    return this.repository.start(aggregate, this.dependencies.dayDate(), write);
  }

  async recordStopEvent(driver: unknown, stop: unknown, action: unknown, key: unknown) {
    const driverId = driverIdentity(driver);
    const stopId = boundedId(stop, "Stop ID");
    if (typeof action !== "string" || !STOP_ACTIONS.includes(action as StopAction)) {
      throw new ValidationError("Stop action is invalid.");
    }
    const typedAction = action as StopAction;
    const expectedByAction = { navigate: "pending", arrive: "navigating", depart: "arrived" } as const;
    const expected = expectedByAction[typedAction];
    const next = transitionStop(expected, typedAction);
    return this.repository.recordStopEvent(
      stopId,
      typedAction,
      expected,
      next,
      this.write(driverId, key, `event:${stopId}:${typedAction}`, null),
    );
  }

  async publishExperience(driver: unknown, stop: unknown, input: unknown, key: unknown) {
    const driverId = driverIdentity(driver);
    const stopId = boundedId(stop, "Stop ID");
    const experience = validateExperience(input);
    return this.repository.publishExperience(
      stopId,
      experience,
      this.write(driverId, key, `experience:${stopId}:${JSON.stringify(experience)}`, null),
    );
  }

  async finish(driver: unknown, workday: unknown, key: unknown) {
    const driverId = driverIdentity(driver);
    const workdayId = boundedId(workday, "Workday ID");
    return this.repository.finish(
      workdayId,
      this.write(driverId, key, `finish:${workdayId}`, null),
    );
  }

  private write(driverId: string, key: unknown, operationPrefix: string, payload: unknown): IdempotentWrite {
    const normalizedKey = idempotencyKey(key);
    return {
      driverId,
      key: normalizedKey,
      operation: `${operationPrefix}${payload === null ? "" : JSON.stringify(payload)}`,
      now: this.dependencies.now().toISOString(),
    };
  }
}
