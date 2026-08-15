import {
  advanceAfterExperience,
  completeAggregate,
  ConflictError,
  MissingError,
  type Equipment,
  type ExperienceInput,
  type StopAction,
  type StopState,
  type WorkdayAggregate,
  type WorkdayStop,
} from "../domain/workday.ts";
import type { IdempotentWrite, WorkdayRepository } from "./workday-repository.ts";

type D1Result = { meta?: { changes?: number } };
type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1Result>;
};
type D1DatabaseLike = {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1Result[]>;
};
type BatchWriteResult =
  | { kind: "committed"; results: D1Result[] }
  | { kind: "replay"; replay: WorkdayAggregate };

type WorkdayRow = {
  id: string;
  state: WorkdayAggregate["state"];
  equipment_type: Equipment["type"];
  truck_number: string;
  trailer_number: string | null;
  trailer_type: Equipment["trailerType"] | null;
  odometer: string;
  active_stop_index: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type StopEventRow = { stop_id: string; action: "arrive" | "depart"; recorded_at: string };
type StopRow = {
  id: string;
  provider_id: string;
  display_name: string;
  address: string;
  stop_type: WorkdayStop["type"];
  stop_order: number;
  state: WorkdayStop["state"];
};

const changes = (result: D1Result | undefined) => result?.meta?.changes ?? 0;

export class D1WorkdayRepository implements WorkdayRepository {
  private readonly db: D1DatabaseLike;

  constructor(database: unknown) {
    this.db = database as D1DatabaseLike;
  }

  async getCurrent(driverId: string): Promise<WorkdayAggregate | null> {
    const row = await this.db.prepare(
      "SELECT id FROM v2_workdays WHERE driver_id = ? ORDER BY (state = 'completed') ASC, updated_at DESC LIMIT 1",
    ).bind(driverId).first<{ id: string }>();
    return row ? this.loadAggregate(row.id, driverId) : null;
  }

  async start(aggregate: WorkdayAggregate, dayDate: string, write: IdempotentWrite): Promise<WorkdayAggregate> {
    const replay = await this.replay(write);
    if (replay) return replay;
    const active = await this.db.prepare(
      "SELECT id FROM v2_workdays WHERE driver_id = ? AND state <> 'completed' LIMIT 1",
    ).bind(write.driverId).first<{ id: string }>();
    if (active) throw new ConflictError("An active workday already exists.");

    const equipment = aggregate.equipment;
    const statements = [
      this.db.prepare(
        "INSERT INTO v2_workdays (id, driver_id, active_key, day_date, state, equipment_type, truck_number, trailer_number, trailer_type, odometer, active_stop_index, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, 0, ?, ?)",
      ).bind(
        aggregate.id,
        write.driverId,
        write.driverId,
        dayDate,
        equipment.type,
        equipment.truckNumber,
        equipment.trailerNumber ?? null,
        equipment.trailerType ?? null,
        equipment.odometer,
        write.now,
        write.now,
      ),
      ...aggregate.stops.map(stop => this.db.prepare(
        "INSERT INTO v2_stops (id, workday_id, driver_id, provider_id, display_name, address, stop_type, stop_order, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
      ).bind(
        stop.id,
        aggregate.id,
        write.driverId,
        stop.providerId,
        stop.displayName,
        stop.address,
        stop.type,
        stop.order,
        write.now,
        write.now,
      )),
      this.db.prepare(
        "INSERT INTO v2_idempotency (driver_id, idempotency_key, operation, workday_id, aggregate, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(write.driverId, write.key, write.operation, aggregate.id, JSON.stringify(aggregate), write.now),
    ];
    try {
      await this.db.batch(statements);
      return structuredClone(aggregate);
    } catch (error) {
      const concurrentReplay = await this.replay(write);
      if (concurrentReplay) return concurrentReplay;
      if (this.isConstraintError(error)) throw new ConflictError("The workday could not be started because its state changed.");
      throw error;
    }
  }

  async recordStopEvent(
    stopId: string,
    action: StopAction,
    expectedState: StopState,
    nextState: StopState,
    write: IdempotentWrite,
  ): Promise<WorkdayAggregate> {
    const replay = await this.replay(write);
    if (replay) return replay;
    const current = await this.loadOwnedByStop(stopId, write.driverId);
    const next: WorkdayAggregate = {
      ...current,
      updatedAt: write.now,
      // The event row stores write.now as created_at, so stamping the same value here keeps the
      // aggregate returned to the caller identical to what a later read projects back.
      stops: current.stops.map(stop => stop.id === stopId
        ? {
            ...stop,
            state: nextState,
            ...(action === "arrive" ? { arrivedAt: write.now } : {}),
            ...(action === "depart" ? { departedAt: write.now } : {}),
          }
        : stop),
    };
    const eventId = crypto.randomUUID();
    const results = await this.batchWithReplay([
      this.db.prepare(
        `INSERT INTO v2_stop_events (id, workday_id, stop_id, driver_id, action, created_at)
         SELECT ?, s.workday_id, s.id, s.driver_id, ?, ?
         FROM v2_stops s
         JOIN v2_workdays w ON w.id = s.workday_id AND w.driver_id = s.driver_id
         WHERE s.id = ? AND s.driver_id = ? AND s.state = ? AND s.stop_order = w.active_stop_index
           AND w.active_stop_index = ? AND w.state = 'active'`,
      ).bind(eventId, action, write.now, stopId, write.driverId, expectedState, current.activeStopIndex),
      this.db.prepare(
        "UPDATE v2_stops SET state = ?, updated_at = ? WHERE id = ? AND driver_id = ? AND EXISTS (SELECT 1 FROM v2_stop_events WHERE id = ?)",
      ).bind(nextState, write.now, stopId, write.driverId, eventId),
      this.db.prepare(
        "UPDATE v2_workdays SET updated_at = ? WHERE id = ? AND driver_id = ? AND EXISTS (SELECT 1 FROM v2_stop_events WHERE id = ?)",
      ).bind(write.now, current.id, write.driverId, eventId),
      this.conditionalIdempotency(write, current.id, next, "v2_stop_events", eventId),
    ], write);
    if (results.kind === "replay") return results.replay;
    if (changes(results.results[0]) !== 1) {
      const committedReplay = await this.replay(write);
      if (committedReplay) return committedReplay;
      throw new ConflictError("The stop transition is stale or invalid.");
    }
    return next;
  }

  async publishExperience(stopId: string, experience: ExperienceInput, write: IdempotentWrite): Promise<WorkdayAggregate> {
    const replay = await this.replay(write);
    if (replay) return replay;
    const current = await this.loadOwnedByStop(stopId, write.driverId);
    const next = { ...advanceAfterExperience(current, stopId), updatedAt: write.now };
    const experienceId = crypto.randomUUID();
    const score = experience.scores;
    const results = await this.batchWithReplay([
      this.db.prepare(
        `INSERT INTO v2_experiences (id, workday_id, stop_id, driver_id, yard, staging, staff, waiting_time, bathroom_access, bathroom_available, bathroom_condition, waiting_category, created_at)
         SELECT ?, s.workday_id, s.id, s.driver_id, ?, ?, ?, ?, ?, ?, ?, ?, ?
         FROM v2_stops s
         JOIN v2_workdays w ON w.id = s.workday_id AND w.driver_id = s.driver_id
         WHERE s.id = ? AND s.driver_id = ? AND s.state = 'departed' AND s.stop_order = w.active_stop_index
           AND w.active_stop_index = ? AND w.state = 'active'
           AND NOT EXISTS (SELECT 1 FROM v2_experiences e WHERE e.stop_id = s.id)`,
      ).bind(
        experienceId,
        score.yard,
        score.staging,
        score.staff,
        score.waitingTime,
        score.bathroomAccess,
        experience.bathroom.available ? 1 : 0,
        experience.bathroom.condition,
        experience.waitingCategory,
        write.now,
        stopId,
        write.driverId,
        current.activeStopIndex,
      ),
      this.db.prepare(
        "UPDATE v2_stops SET state = 'experience_published', updated_at = ? WHERE id = ? AND driver_id = ? AND EXISTS (SELECT 1 FROM v2_experiences WHERE id = ?)",
      ).bind(write.now, stopId, write.driverId, experienceId),
      this.db.prepare(
        "UPDATE v2_workdays SET active_stop_index = active_stop_index + 1, updated_at = ? WHERE id = ? AND driver_id = ? AND EXISTS (SELECT 1 FROM v2_experiences WHERE id = ?)",
      ).bind(write.now, current.id, write.driverId, experienceId),
      this.conditionalIdempotency(write, current.id, next, "v2_experiences", experienceId),
    ], write);
    if (results.kind === "replay") return results.replay;
    if (changes(results.results[0]) !== 1) {
      const committedReplay = await this.replay(write);
      if (committedReplay) return committedReplay;
      throw new ConflictError("The experience publish is stale or invalid.");
    }
    return next;
  }

  async finish(workdayId: string, write: IdempotentWrite): Promise<WorkdayAggregate> {
    const replay = await this.replay(write);
    if (replay) return replay;
    const current = await this.loadAggregate(workdayId, write.driverId);
    if (!current) throw new MissingError("Workday not found.");
    const next = { ...completeAggregate(current), updatedAt: write.now, completedAt: write.now };
    const results = await this.batchWithReplay([
      this.db.prepare(
        `UPDATE v2_workdays
         SET state = 'completed', active_key = NULL, active_stop_index = (SELECT count(*) FROM v2_stops WHERE workday_id = ?), updated_at = ?, completed_at = ?
         WHERE id = ? AND driver_id = ? AND state = 'active'
           AND NOT EXISTS (SELECT 1 FROM v2_stops WHERE workday_id = ? AND state <> 'experience_published')`,
      ).bind(workdayId, write.now, write.now, workdayId, write.driverId, workdayId),
      this.db.prepare(
        `INSERT INTO v2_idempotency (driver_id, idempotency_key, operation, workday_id, aggregate, created_at)
         SELECT ?, ?, ?, id, ?, ? FROM v2_workdays
         WHERE id = ? AND driver_id = ? AND state = 'completed' AND completed_at = ?`,
      ).bind(write.driverId, write.key, write.operation, JSON.stringify(next), write.now, workdayId, write.driverId, write.now),
    ], write);
    if (results.kind === "replay") return results.replay;
    if (changes(results.results[0]) !== 1) {
      const committedReplay = await this.replay(write);
      if (committedReplay) return committedReplay;
      throw new ConflictError("The workday is stale or not ready to finish.");
    }
    return next;
  }

  private async loadOwnedByStop(stopId: string, driverId: string): Promise<WorkdayAggregate> {
    const row = await this.db.prepare(
      "SELECT workday_id FROM v2_stops WHERE id = ? AND driver_id = ? LIMIT 1",
    ).bind(stopId, driverId).first<{ workday_id: string }>();
    if (!row) throw new MissingError("Stop not found.");
    const aggregate = await this.loadAggregate(row.workday_id, driverId);
    if (!aggregate) throw new MissingError("Stop not found.");
    return aggregate;
  }

  private async loadAggregate(workdayId: string, driverId: string): Promise<WorkdayAggregate | null> {
    const row = await this.db.prepare(
      `SELECT id, state, equipment_type, truck_number, trailer_number, trailer_type, odometer,
              active_stop_index, created_at, updated_at, completed_at
       FROM v2_workdays WHERE id = ? AND driver_id = ? LIMIT 1`,
    ).bind(workdayId, driverId).first<WorkdayRow>();
    if (!row) return null;
    const stopRows = await this.db.prepare(
      `SELECT id, provider_id, display_name, address, stop_type, stop_order, state
       FROM v2_stops WHERE workday_id = ? AND driver_id = ? ORDER BY stop_order`,
    ).bind(workdayId, driverId).all<StopRow>();
    // Arrive and Depart are already durable in v2_stop_events, so the recorded times are
    // projected onto each stop rather than duplicated into v2_stops. The first event of each
    // action wins, which keeps an idempotent retry from moving a recorded time.
    const eventRows = await this.db.prepare(
      `SELECT stop_id, action, MIN(created_at) AS recorded_at
       FROM v2_stop_events
       WHERE workday_id = ? AND driver_id = ? AND action IN ('arrive', 'depart')
       GROUP BY stop_id, action`,
    ).bind(workdayId, driverId).all<StopEventRow>();
    const recordedTimes = new Map<string, { arrivedAt?: string; departedAt?: string }>();
    for (const event of eventRows.results) {
      const entry = recordedTimes.get(event.stop_id) ?? {};
      if (event.action === "arrive") entry.arrivedAt = event.recorded_at;
      if (event.action === "depart") entry.departedAt = event.recorded_at;
      recordedTimes.set(event.stop_id, entry);
    }
    const equipment: Equipment = {
      type: row.equipment_type,
      truckNumber: row.truck_number,
      odometer: row.odometer,
      ...(row.trailer_number === null ? {} : { trailerNumber: row.trailer_number }),
      ...(row.trailer_type === null ? {} : { trailerType: row.trailer_type }),
    };
    return {
      id: row.id,
      state: row.state,
      activeStopIndex: row.active_stop_index,
      equipment,
      stops: stopRows.results.map(stop => ({
        id: stop.id,
        providerId: stop.provider_id,
        displayName: stop.display_name,
        address: stop.address,
        type: stop.stop_type,
        order: stop.stop_order,
        state: stop.state,
        ...recordedTimes.get(stop.id),
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }

  private async replay(write: IdempotentWrite): Promise<WorkdayAggregate | null> {
    const row = await this.db.prepare(
      "SELECT operation, aggregate FROM v2_idempotency WHERE driver_id = ? AND idempotency_key = ? LIMIT 1",
    ).bind(write.driverId, write.key).first<{ operation: string; aggregate: string }>();
    if (!row) return null;
    if (row.operation !== write.operation) throw new ConflictError("The idempotency key was already used for another request.");
    return JSON.parse(row.aggregate) as WorkdayAggregate;
  }

  private conditionalIdempotency(
    write: IdempotentWrite,
    workdayId: string,
    aggregate: WorkdayAggregate,
    sentinelTable: "v2_stop_events" | "v2_experiences",
    sentinelId: string,
  ) {
    return this.db.prepare(
      `INSERT INTO v2_idempotency (driver_id, idempotency_key, operation, workday_id, aggregate, created_at)
       SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM ${sentinelTable} WHERE id = ?)`,
    ).bind(write.driverId, write.key, write.operation, workdayId, JSON.stringify(aggregate), write.now, sentinelId);
  }

  private async batchWithReplay(statements: D1Statement[], write: IdempotentWrite): Promise<BatchWriteResult> {
    try {
      return { kind: "committed", results: await this.db.batch(statements) };
    } catch (error) {
      const replay = await this.replay(write);
      if (replay) return { kind: "replay", replay };
      if (this.isConstraintError(error)) throw new ConflictError("The request conflicts with committed state.");
      throw error;
    }
  }

  private isConstraintError(error: unknown) {
    return error instanceof Error && /constraint|unique/i.test(error.message);
  }
}
