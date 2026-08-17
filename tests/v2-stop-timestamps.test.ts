import assert from "node:assert/strict";
import test from "node:test";
import { formatClockTime, formatDuration } from "../app/v2/workflow/time.ts";
import { resolveBackTarget } from "../app/v2/workflow/back-navigation.ts";
import { MemoryWorkdayRepository } from "../app/v2/server/memory-workday-repository.ts";
import type { WorkdayAggregate } from "../app/v2/domain/workday.ts";

const equipment = { type: "tractor", truckNumber: "TRK-7", trailerType: "reefer", trailerNumber: "TRL-8", odometer: "44100" } as const;

const stops = [
  { providerId: "p-1", displayName: "Dock A", address: "1 First St", type: "delivery", order: 0 },
  { providerId: "p-2", displayName: "Dock B", address: "2 Second St", type: "pickup", order: 1 },
] as const;

function write(key: string, now: string) {
  return { key, driverId: "driver@example.com", now, operation: "op" };
}

test("recorded Work Mode actions surface arrival and departure times on the aggregate", async () => {
  const repository = new MemoryWorkdayRepository();
  const seed: WorkdayAggregate = {
    id: "day-1",
    state: "active",
    activeStopIndex: 0,
    equipment: { ...equipment },
    stops: stops.map((stop, index) => ({ ...stop, id: `stop-${index + 1}`, state: "pending" })),
    createdAt: "2026-08-17T12:00:00.000Z",
  };
  const started = await repository.start(seed, "2026-08-17", write("start", "2026-08-17T12:00:00.000Z"));
  const stopId = started.stops[0].id;

  // A pending stop has recorded nothing yet.
  assert.equal(started.stops[0].arrivedAt, undefined);
  assert.equal(started.stops[0].departedAt, undefined);

  const navigated = await repository.recordStopEvent(stopId, "navigate", "pending", "navigating", write("e1", "2026-08-17T13:00:00.000Z"));
  assert.equal(navigated.stops[0].navigatedAt, "2026-08-17T13:00:00.000Z");

  const arrived = await repository.recordStopEvent(stopId, "arrive", "navigating", "arrived", write("e2", "2026-08-17T13:30:00.000Z"));
  assert.equal(arrived.stops[0].arrivedAt, "2026-08-17T13:30:00.000Z");

  const departed = await repository.recordStopEvent(stopId, "depart", "arrived", "departed", write("e3", "2026-08-17T14:50:00.000Z"));
  assert.equal(departed.stops[0].departedAt, "2026-08-17T14:50:00.000Z");

  // Earlier recordings are preserved, and untouched stops stay clean.
  assert.equal(departed.stops[0].arrivedAt, "2026-08-17T13:30:00.000Z");
  assert.equal(departed.stops[1].arrivedAt, undefined);

  assert.equal(formatDuration(departed.stops[0].arrivedAt, departed.stops[0].departedAt), "1 hr 20 min");
});

test("time formatting tolerates missing, malformed, and reversed values", () => {
  assert.equal(formatClockTime(undefined), null);
  assert.equal(formatClockTime("not-a-date"), null);
  assert.equal(formatDuration(undefined, "2026-08-17T14:00:00.000Z"), null);
  assert.equal(formatDuration("2026-08-17T14:00:00.000Z", undefined), null);
  // A clock skew that runs backwards must not render a negative duration.
  assert.equal(formatDuration("2026-08-17T15:00:00.000Z", "2026-08-17T14:00:00.000Z"), null);
  assert.equal(formatDuration("2026-08-17T14:00:00.000Z", "2026-08-17T14:00:30.000Z"), "Less than a minute");
  assert.equal(formatDuration("2026-08-17T14:00:00.000Z", "2026-08-17T14:45:00.000Z"), "45 min");
  assert.equal(formatDuration("2026-08-17T14:00:00.000Z", "2026-08-17T16:00:00.000Z"), "2 hr");
});

test("Android Back walks setup backwards and only exits from the first screen", () => {
  assert.deepEqual(resolveBackTarget("setup", "trailer-choice"), { kind: "stage", stage: "equipment-choice" });
  assert.deepEqual(resolveBackTarget("setup", "equipment-ready"), { kind: "stage", stage: "equipment-info" });
  assert.deepEqual(resolveBackTarget("setup", "organize"), { kind: "stage", stage: "route-list" });
  assert.deepEqual(resolveBackTarget("setup", "prepare"), { kind: "stage", stage: "route-list" });
  assert.deepEqual(resolveBackTarget("setup", "stop-type"), { kind: "stage", stage: "route-search" });

  // First stage of each setup phase returns Home rather than exiting.
  assert.deepEqual(resolveBackTarget("setup", "equipment-choice"), { kind: "view", view: "home" });
  assert.deepEqual(resolveBackTarget("setup", "route-search"), { kind: "view", view: "home" });

  // Home exits; an active workday is server authoritative and does not rewind.
  assert.deepEqual(resolveBackTarget("home", "equipment-choice"), { kind: "exit" });
  assert.deepEqual(resolveBackTarget("active", "prepare"), { kind: "exit" });
  assert.deepEqual(resolveBackTarget("completed", "prepare"), { kind: "exit" });
});
