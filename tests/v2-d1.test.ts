import assert from "node:assert/strict";
import test from "node:test";
import { applyMigrations, createTestD1, migrationFiles } from "./v2-d1-test-utils.ts";

async function loadServer() {
  try {
    const [{ WorkdayService }, { D1WorkdayRepository }] = await Promise.all([
      import("../app/v2/server/workday-service.ts"),
      import("../app/v2/server/d1-workday-repository.ts"),
    ]);
    return { WorkdayService, D1WorkdayRepository };
  } catch (error) {
    assert.fail(`v2 D1 repository must exist: ${String(error)}`);
  }
}

const equipment = { type: "cargo_van", truckNumber: "V-17", odometer: "50100" };
const route = [
  { providerId: "osm:relation:701", displayName: "Receiver", address: "100 Main St", type: "delivery", order: 0 },
];
const experience = {
  scores: { yard: 5, staging: 4, staff: 3, waitingTime: 2, bathroomAccess: 1 },
  waitingCategory: "long",
  bathroom: { available: true, condition: "needs_improvement" },
};

function dependencies() {
  let sequence = 0;
  let now = new Date("2026-08-11T12:00:00.000Z");
  return {
    ids: () => `d1-${++sequence}`,
    now: () => now,
    dayDate: () => now.toISOString().slice(0, 10),
    nextDay: () => { now = new Date("2026-08-12T12:00:00.000Z"); },
  };
}

async function setup(t: test.TestContext) {
  const { db, dispose } = await createTestD1();
  t.after(dispose);
  await applyMigrations(db, await migrationFiles());
  const { WorkdayService, D1WorkdayRepository } = await loadServer();
  const deps = dependencies();
  return { db, deps, service: new WorkdayService(new D1WorkdayRepository(db), deps) };
}

test("real D1 replays start, events, and publish without duplicate rows", async t => {
  const { db, service } = await setup(t);
  const [started, startedReplay] = await Promise.all([
    service.start("driver@example.com", { equipment, stops: route }, "start-key"),
    service.start("driver@example.com", { equipment, stops: route }, "start-key"),
  ]);
  assert.deepEqual(startedReplay, started);
  assert.equal(await db.prepare("SELECT count(*) AS count FROM v2_workdays").first<number>("count"), 1);
  assert.equal(await db.prepare("SELECT count(*) AS count FROM v2_stops").first<number>("count"), 1);

  const stopId = started.stops[0].id;
  const [navigated, navigatedReplay] = await Promise.all([
    service.recordStopEvent("driver@example.com", stopId, "navigate", "nav-key"),
    service.recordStopEvent("driver@example.com", stopId, "navigate", "nav-key"),
  ]);
  assert.deepEqual(navigatedReplay, navigated);
  await service.recordStopEvent("driver@example.com", stopId, "arrive", "arrive-key");
  await service.recordStopEvent("driver@example.com", stopId, "depart", "depart-key");
  assert.equal(await db.prepare("SELECT count(*) AS count FROM v2_stop_events").first<number>("count"), 3);

  const [published, publishedReplay] = await Promise.all([
    service.publishExperience("driver@example.com", stopId, experience, "publish-key"),
    service.publishExperience("driver@example.com", stopId, experience, "publish-key"),
  ]);
  assert.deepEqual(publishedReplay, published);
  assert.equal(await db.prepare("SELECT count(*) AS count FROM v2_experiences").first<number>("count"), 1);
  assert.deepEqual(await db.prepare("SELECT bathroom_access, bathroom_available, bathroom_condition FROM v2_experiences WHERE stop_id = ?").bind(stopId).first(), {
    bathroom_access: 1,
    bathroom_available: 1,
    bathroom_condition: "needs_improvement",
  });
  assert.equal(await db.prepare("SELECT count(*) AS count FROM v2_idempotency").first<number>("count"), 5);
  assert.equal(published.activeStopIndex, 1);

  const [finished, concurrentFinishReplay] = await Promise.all([
    service.finish("driver@example.com", published.id, "finish-key"),
    service.finish("driver@example.com", published.id, "finish-key"),
  ]);
  const sequentialFinishReplay = await service.finish("driver@example.com", published.id, "finish-key");
  assert.deepEqual(concurrentFinishReplay, finished);
  assert.deepEqual(sequentialFinishReplay, finished);
  assert.equal(finished.state, "completed");
  assert.equal(await db.prepare("SELECT count(*) AS count FROM v2_workdays WHERE id = ? AND state = 'completed'")
    .bind(published.id).first<number>("count"), 1);
  assert.equal(await db.prepare("SELECT count(*) AS count FROM v2_idempotency WHERE driver_id = ? AND idempotency_key = ? AND operation = ?")
    // The operation string now carries the ending-odometer payload, matching how every other
    // mutation encodes its payload, so a retry under the same key with a different reading is
    // still caught by idempotency replay rather than silently applying a new value.
    .bind("driver@example.com", "finish-key", `finish:${published.id}:`).first<number>("count"), 1);
  const storedFinish = await db.prepare("SELECT aggregate FROM v2_idempotency WHERE driver_id = ? AND idempotency_key = ?")
    .bind("driver@example.com", "finish-key").first<string>("aggregate");
  assert.deepEqual(JSON.parse(storedFinish ?? "null"), finished);
});

test("real D1 conditional batches leave no event, experience, or state change on stale preconditions", async t => {
  const { db, service } = await setup(t);
  const started = await service.start("driver@example.com", { equipment, stops: route }, "start");
  const stopId = started.stops[0].id;

  await assert.rejects(service.recordStopEvent("driver@example.com", stopId, "arrive", "stale-arrive"), { name: "ConflictError" });
  assert.equal(await db.prepare("SELECT count(*) AS count FROM v2_stop_events").first<number>("count"), 0);
  assert.equal(await db.prepare("SELECT state FROM v2_stops WHERE id = ?").bind(stopId).first<string>("state"), "pending");

  await service.recordStopEvent("driver@example.com", stopId, "navigate", "nav");
  await service.recordStopEvent("driver@example.com", stopId, "arrive", "arrive");
  await assert.rejects(service.publishExperience("driver@example.com", stopId, experience, "stale-publish"), { name: "ConflictError" });
  assert.equal(await db.prepare("SELECT count(*) AS count FROM v2_experiences").first<number>("count"), 0);
  assert.equal(await db.prepare("SELECT state FROM v2_stops WHERE id = ?").bind(stopId).first<string>("state"), "arrived");
  assert.equal(await db.prepare("SELECT active_stop_index FROM v2_workdays WHERE id = ?").bind(started.id).first<number>("active_stop_index"), 0);
});

test("real D1 rejects an adjacent-stop write based on a stale authoritative index", async t => {
  const { db, service } = await setup(t);
  const twoStops = [
    route[0],
    { providerId: "osm:way:902", displayName: "Shipper", address: "200 Lake Ave", type: "pickup", order: 1 },
  ];
  let workday = await service.start("driver@example.com", { equipment, stops: twoStops }, "start-race");
  const [first, second] = workday.stops.map(stop => stop.id);
  workday = await service.recordStopEvent("driver@example.com", first, "navigate", "first-nav");
  workday = await service.recordStopEvent("driver@example.com", first, "arrive", "first-arrive");
  await service.recordStopEvent("driver@example.com", first, "depart", "first-depart");

  let releaseBatch!: () => void;
  let batchReached!: () => void;
  const batchIsPaused = new Promise<void>(resolve => { batchReached = resolve; });
  const batchMayContinue = new Promise<void>(resolve => { releaseBatch = resolve; });
  const pausingDatabase = {
    prepare: db.prepare.bind(db),
    batch: async (statements: Parameters<typeof db.batch>[0]) => {
      batchReached();
      await batchMayContinue;
      return db.batch(statements);
    },
  };
  const { WorkdayService, D1WorkdayRepository } = await loadServer();
  const racedService = new WorkdayService(new D1WorkdayRepository(pausingDatabase), dependencies());
  const staleNavigate = racedService.recordStopEvent("driver@example.com", second, "navigate", "second-nav-stale");
  await batchIsPaused;
  await service.publishExperience("driver@example.com", first, experience, "first-publish");
  releaseBatch();

  await assert.rejects(staleNavigate, { name: "ConflictError" });
  assert.equal(await db.prepare("SELECT state FROM v2_stops WHERE id = ?").bind(second).first<string>("state"), "pending");
  assert.equal(await db.prepare("SELECT count(*) AS count FROM v2_stop_events WHERE stop_id = ?").bind(second).first<number>("count"), 0);
  const retried = await service.recordStopEvent("driver@example.com", second, "navigate", "second-nav-stale");
  assert.equal(retried.activeStopIndex, 1);
  assert.equal(retried.stops[1].state, "navigating");
});

test("real D1 rejects invalid input without writes and hides cross-tenant stops", async t => {
  const { db, service } = await setup(t);
  await assert.rejects(
    service.start("driver-a@example.com", { equipment, stops: [{ ...route[0], providerId: "osm:node:0007" }] }, "invalid"),
    { name: "ValidationError" },
  );
  assert.equal(await db.prepare("SELECT count(*) AS count FROM v2_workdays").first<number>("count"), 0);
  assert.equal(await db.prepare("SELECT count(*) AS count FROM v2_stops").first<number>("count"), 0);

  const started = await service.start("driver-a@example.com", { equipment, stops: route }, "valid");
  await assert.rejects(
    service.recordStopEvent("driver-b@example.com", started.stops[0].id, "navigate", "cross-driver"),
    { name: "MissingError" },
  );
  assert.equal(await db.prepare("SELECT count(*) AS count FROM v2_stop_events").first<number>("count"), 0);
});

test("real D1 permits same-place reuse across drivers and a later completed workday", async t => {
  const { db, deps, service } = await setup(t);
  let dayA = await service.start("driver-a@example.com", { equipment, stops: route }, "a-start");
  const dayB = await service.start("driver-b@example.com", { equipment, stops: route }, "b-start");
  assert.notEqual(dayA.stops[0].id, dayB.stops[0].id);

  dayA = await service.recordStopEvent("driver-a@example.com", dayA.stops[0].id, "navigate", "a-nav");
  dayA = await service.recordStopEvent("driver-a@example.com", dayA.stops[0].id, "arrive", "a-arrive");
  dayA = await service.recordStopEvent("driver-a@example.com", dayA.stops[0].id, "depart", "a-depart");
  dayA = await service.publishExperience("driver-a@example.com", dayA.stops[0].id, experience, "a-publish");
  await service.finish("driver-a@example.com", dayA.id, "a-finish");
  deps.nextDay();
  const later = await service.start("driver-a@example.com", { equipment, stops: route }, "a-later");

  assert.notEqual(later.id, dayA.id);
  assert.equal(await db.prepare("SELECT count(*) AS count FROM v2_stops WHERE provider_id = ?")
    .bind(route[0].providerId).first<number>("count"), 3);
});

test("real D1 persists the ending odometer on finish and projects it back on read", async t => {
  const { db, service } = await setup(t);
  let workday = await service.start("driver@example.com", { equipment, stops: route }, "start-key");
  const stopId = workday.stops[0].id;
  workday = await service.recordStopEvent("driver@example.com", stopId, "navigate", "nav");
  workday = await service.recordStopEvent("driver@example.com", stopId, "arrive", "arrive");
  workday = await service.recordStopEvent("driver@example.com", stopId, "depart", "depart");
  workday = await service.publishExperience("driver@example.com", stopId, experience, "publish");

  const finished = await service.finish("driver@example.com", workday.id, "finish", "50318");
  assert.equal(finished.endingOdometer, "50318");
  assert.equal(await db.prepare("SELECT ending_odometer FROM v2_workdays WHERE id = ?")
    .bind(workday.id).first<string>("ending_odometer"), "50318");

  const reread = await service.getCurrent("driver@example.com");
  assert.equal(reread?.endingOdometer, "50318");
});
