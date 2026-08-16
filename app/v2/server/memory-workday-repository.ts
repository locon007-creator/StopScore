import {
  advanceAfterExperience,
  completeAggregate,
  ConflictError,
  MissingError,
  summarizeExperiences,
  type ExperienceInput,
  type StopAction,
  type StopKnowledgeSummary,
  type StopState,
  type WorkdayAggregate,
} from "../domain/workday.ts";
import type { IdempotentWrite, WorkdayRepository } from "./workday-repository.ts";

type StoredWorkday = { aggregate: WorkdayAggregate; dayDate: string };
type StoredExperience = { providerId: string; input: ExperienceInput; createdAt: string };
type Replay = { operation: string; aggregate: WorkdayAggregate };

const clone = <T>(value: T): T => structuredClone(value);

export class MemoryWorkdayRepository implements WorkdayRepository {
  private readonly workdays = new Map<string, StoredWorkday>();
  private readonly idempotency = new Map<string, Replay>();
  private readonly experiences: StoredExperience[] = [];

  async getCurrent(driverId: string): Promise<WorkdayAggregate | null> {
    const matching = [...this.workdays.values()]
      .map(entry => entry.aggregate)
      .filter(aggregate => this.ownerOf(aggregate.id) === driverId)
      .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""));
    return clone(matching.find(aggregate => aggregate.state !== "completed") ?? matching[0] ?? null);
  }

  async start(aggregate: WorkdayAggregate, dayDate: string, write: IdempotentWrite): Promise<WorkdayAggregate> {
    const replay = this.replay(write);
    if (replay) return replay;
    const active = [...this.workdays.values()].find(entry =>
      this.ownerOf(entry.aggregate.id) === write.driverId && entry.aggregate.state !== "completed");
    if (active) throw new ConflictError("An active workday already exists.");
    this.workdays.set(aggregate.id, { aggregate: clone(aggregate), dayDate });
    return this.commitReplay(write, aggregate);
  }

  async recordStopEvent(
    stopId: string,
    action: StopAction,
    expectedState: StopState,
    nextState: StopState,
    write: IdempotentWrite,
  ): Promise<WorkdayAggregate> {
    const replay = this.replay(write);
    if (replay) return replay;
    const stored = this.ownedByStop(write.driverId, stopId);
    const index = stored.aggregate.stops.findIndex(stop => stop.id === stopId);
    const stop = stored.aggregate.stops[index];
    if (stored.aggregate.state !== "active" || index !== stored.aggregate.activeStopIndex || stop.state !== expectedState) {
      throw new ConflictError("The stop transition is stale or invalid.");
    }
    stored.aggregate = {
      ...stored.aggregate,
      updatedAt: write.now,
      stops: stored.aggregate.stops.map(item => item.id === stopId
        ? {
            ...item,
            state: nextState,
            ...(action === "arrive" ? { arrivedAt: write.now } : {}),
            ...(action === "depart" ? { departedAt: write.now } : {}),
          }
        : { ...item }),
    };
    return this.commitReplay(write, stored.aggregate);
  }

  async publishExperience(stopId: string, experience: ExperienceInput, write: IdempotentWrite): Promise<WorkdayAggregate> {
    const replay = this.replay(write);
    if (replay) return replay;
    const stored = this.ownedByStop(write.driverId, stopId);
    if (stored.aggregate.state !== "active") throw new ConflictError("The workday is not active.");
    const stop = stored.aggregate.stops.find(item => item.id === stopId);
    if (stop) this.experiences.push({ providerId: stop.providerId, input: experience, createdAt: write.now });
    stored.aggregate = { ...advanceAfterExperience(stored.aggregate, stopId), updatedAt: write.now };
    return this.commitReplay(write, stored.aggregate);
  }

  async getStopKnowledge(providerId: string): Promise<StopKnowledgeSummary | null> {
    const rows = this.experiences
      .filter(entry => entry.providerId === providerId)
      .map(entry => ({ scores: entry.input.scores, comment: entry.input.comment, createdAt: entry.createdAt }));
    return summarizeExperiences(rows);
  }

  async finish(workdayId: string, write: IdempotentWrite, endingOdometer: string | null): Promise<WorkdayAggregate> {
    const replay = this.replay(write);
    if (replay) return replay;
    const stored = this.workdays.get(workdayId);
    if (!stored || this.ownerOf(workdayId) !== write.driverId) throw new MissingError("Workday not found.");
    stored.aggregate = {
      ...completeAggregate(stored.aggregate),
      updatedAt: write.now,
      completedAt: write.now,
      ...(endingOdometer ? { endingOdometer } : {}),
    };
    return this.commitReplay(write, stored.aggregate);
  }

  private ownerOf(workdayId: string) {
    return this.workdayOwners.get(workdayId);
  }

  private readonly workdayOwners = new Map<string, string>();

  private ownedByStop(driverId: string, stopId: string): StoredWorkday {
    const stored = [...this.workdays.values()].find(entry =>
      this.ownerOf(entry.aggregate.id) === driverId && entry.aggregate.stops.some(stop => stop.id === stopId));
    if (!stored) throw new MissingError("Stop not found.");
    return stored;
  }

  private replay(write: IdempotentWrite): WorkdayAggregate | null {
    const replay = this.idempotency.get(`${write.driverId}\u0000${write.key}`);
    if (!replay) return null;
    if (replay.operation !== write.operation) throw new ConflictError("The idempotency key was already used for another request.");
    return clone(replay.aggregate);
  }

  private commitReplay(write: IdempotentWrite, aggregate: WorkdayAggregate): WorkdayAggregate {
    this.workdayOwners.set(aggregate.id, write.driverId);
    const committed = clone(aggregate);
    this.idempotency.set(`${write.driverId}\u0000${write.key}`, { operation: write.operation, aggregate: committed });
    return clone(committed);
  }
}
