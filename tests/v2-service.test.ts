import assert from "node:assert/strict";
import test from "node:test";

async function loadServer() {
  try {
    const [{ WorkdayService }, { MemoryWorkdayRepository }] = await Promise.all([
      import("../app/v2/server/workday-service.ts"),
      import("../app/v2/server/memory-workday-repository.ts"),
    ]);
    return { WorkdayService, MemoryWorkdayRepository };
  } catch (error) {
    assert.fail(`v2 service and injected memory repository must exist: ${String(error)}`);
  }
}

const equipment = { type: "cargo_van", truckNumber: "V-17", odometer: "50100" };
const stops = [
  { id: "client-owned-id", providerId: "osm:node:101", displayName: "Receiver", address: "100 Main St", type: "delivery", order: 0 },
  { providerId: "osm:way:202", displayName: "Shipper", address: "200 Lake Ave", type: "pickup", order: 1 },
];

function dependencies() {
  let sequence = 0;
  let now = new Date("2026-08-11T12:00:00.000Z");
  return {
    ids: () => `server-${++sequence}`,
    now: () => now,
    dayDate: () => now.toISOString().slice(0, 10),
    nextDay: () => { now = new Date("2026-08-12T12:00:00.000Z"); },
  };
}

test("start validates before writing and assigns server-owned workday-scoped stop IDs", async () => {
  const { WorkdayService, MemoryWorkdayRepository } = await loadServer();
  const repo = new MemoryWorkdayRepository();
  const deps = dependencies();
  const service = new WorkdayService(repo, deps);

  await assert.rejects(
    service.start("driver-a@example.com", { equipment, stops: [{ ...stops[0], providerId: "fake-101" }] }, "start-invalid"),
    { name: "ValidationError" },
  );
  assert.equal(await service.getCurrent("driver-a@example.com"), null, "invalid input must not create a workday");

  const started = await service.start("Driver-A@example.com", { equipment, stops }, "start-1");
  assert.equal(started.state, "active");
  assert.equal(started.activeStopIndex, 0);
  assert.equal(started.stops.length, 2);
  assert.notEqual(started.stops[0].id, "client-owned-id");
  assert.match(started.stops[0].id, new RegExp(`^${started.id}:stop:`));
  assert.match(started.stops[1].id, new RegExp(`^${started.id}:stop:`));
  assert.deepEqual(await service.getCurrent("driver-a@example.com"), started);
  assert.equal(await service.getCurrent("driver-b@example.com"), null);
});

test("legal workflow advances only after experience persistence and then finishes", async () => {
  const { WorkdayService, MemoryWorkdayRepository } = await loadServer();
  const deps = dependencies();
  const service = new WorkdayService(new MemoryWorkdayRepository(), deps);
  let workday = await service.start("driver@example.com", { equipment, stops }, "start");
  const first = workday.stops[0].id;

  workday = await service.recordStopEvent("driver@example.com", first, "navigate", "nav-1");
  assert.equal(workday.stops[0].state, "navigating");
  assert.equal(workday.activeStopIndex, 0);
  workday = await service.recordStopEvent("driver@example.com", first, "arrive", "arrive-1");
  workday = await service.recordStopEvent("driver@example.com", first, "depart", "depart-1");
  assert.equal(workday.stops[0].state, "departed");
  assert.equal(workday.activeStopIndex, 0, "departure must not advance the authoritative index");

  const experience = {
    scores: { yard: 5, staging: 4, staff: 3, waitingTime: 2, bathroomAccess: 1 },
    waitingCategory: "standard",
    bathroom: { available: false, condition: null },
  };
  workday = await service.publishExperience("driver@example.com", first, experience, "publish-1");
  assert.equal(workday.stops[0].state, "experience_published");
  assert.equal(workday.activeStopIndex, 1);
  await assert.rejects(service.finish("driver@example.com", workday.id, "finish-too-early"), { name: "ConflictError" });

  const second = workday.stops[1].id;
  workday = await service.recordStopEvent("driver@example.com", second, "navigate", "nav-2");
  workday = await service.recordStopEvent("driver@example.com", second, "arrive", "arrive-2");
  workday = await service.recordStopEvent("driver@example.com", second, "depart", "depart-2");
  workday = await service.publishExperience("driver@example.com", second, experience, "publish-2");
  assert.equal(workday.activeStopIndex, 2);
  workday = await service.finish("driver@example.com", workday.id, "finish");
  assert.equal(workday.state, "completed");
  assert.equal(workday.completedAt, "2026-08-11T12:00:00.000Z");
});

test("replays return committed aggregates and key reuse for a different operation conflicts", async () => {
  const { WorkdayService, MemoryWorkdayRepository } = await loadServer();
  const service = new WorkdayService(new MemoryWorkdayRepository(), dependencies());
  const started = await service.start("driver@example.com", { equipment, stops: [stops[0]] }, "same-start");
  assert.deepEqual(await service.start("driver@example.com", { equipment, stops: [stops[0]] }, "same-start"), started);

  const navigated = await service.recordStopEvent("driver@example.com", started.stops[0].id, "navigate", "same-event");
  assert.deepEqual(await service.recordStopEvent("driver@example.com", started.stops[0].id, "navigate", "same-event"), navigated);
  await assert.rejects(
    service.recordStopEvent("driver@example.com", started.stops[0].id, "arrive", "same-event"),
    { name: "ConflictError" },
  );
});

test("missing and stale operations are distinct and tenant ownership is enforced", async () => {
  const { WorkdayService, MemoryWorkdayRepository } = await loadServer();
  const service = new WorkdayService(new MemoryWorkdayRepository(), dependencies());
  const started = await service.start("driver-a@example.com", { equipment, stops: [stops[0]] }, "start");

  await assert.rejects(
    service.recordStopEvent("driver-b@example.com", started.stops[0].id, "navigate", "cross-tenant"),
    { name: "MissingError" },
  );
  await assert.rejects(
    service.recordStopEvent("driver-a@example.com", "missing-stop", "navigate", "missing"),
    { name: "MissingError" },
  );
  await assert.rejects(
    service.recordStopEvent("driver-a@example.com", started.stops[0].id, "arrive", "stale"),
    { name: "ConflictError" },
  );
});

test("the same canonical place can be reused by another driver and on a later completed day", async () => {
  const { WorkdayService, MemoryWorkdayRepository } = await loadServer();
  const deps = dependencies();
  const service = new WorkdayService(new MemoryWorkdayRepository(), deps);
  const oneStop = [stops[0]];
  const experience = {
    scores: { yard: 5, staging: 5, staff: 5, waitingTime: 5, bathroomAccess: 5 },
    waitingCategory: "quick",
    bathroom: { available: true, condition: "clean" },
  };
  let dayA = await service.start("driver-a@example.com", { equipment, stops: oneStop }, "a-start");
  const dayB = await service.start("driver-b@example.com", { equipment, stops: oneStop }, "b-start");
  assert.equal(dayA.stops[0].providerId, dayB.stops[0].providerId);
  assert.notEqual(dayA.stops[0].id, dayB.stops[0].id);

  dayA = await service.recordStopEvent("driver-a@example.com", dayA.stops[0].id, "navigate", "a-nav");
  dayA = await service.recordStopEvent("driver-a@example.com", dayA.stops[0].id, "arrive", "a-arrive");
  dayA = await service.recordStopEvent("driver-a@example.com", dayA.stops[0].id, "depart", "a-depart");
  dayA = await service.publishExperience("driver-a@example.com", dayA.stops[0].id, experience, "a-publish");
  await service.finish("driver-a@example.com", dayA.id, "a-finish");
  deps.nextDay();
  const later = await service.start("driver-a@example.com", { equipment, stops: oneStop }, "a-next-start");
  assert.equal(later.stops[0].providerId, dayA.stops[0].providerId);
  assert.notEqual(later.id, dayA.id);
  assert.notEqual(later.stops[0].id, dayA.stops[0].id);
});
