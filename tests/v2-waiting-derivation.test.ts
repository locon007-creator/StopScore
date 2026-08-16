import assert from "node:assert/strict";
import test from "node:test";

async function workflow() {
  return import("../app/v2/workflow/model.ts");
}

const stop = (arrivedAt?: string, departedAt?: string) => ({
  id: "stop-1",
  providerId: "osm:node:1",
  displayName: "FedEx Ground",
  address: "1234 Commerce Blvd, Memphis, TN 38118",
  type: "delivery" as const,
  order: 0,
  state: "departed" as const,
  ...(arrivedAt ? { arrivedAt } : {}),
  ...(departedAt ? { departedAt } : {}),
});

test("waiting time is measured from the recorded arrive and depart", async () => {
  const { stopWaitingMinutes } = await workflow();
  assert.equal(stopWaitingMinutes(stop("2026-05-16T09:42:00Z", "2026-05-16T10:00:00Z")), 18);
  assert.equal(stopWaitingMinutes(stop("2026-05-16T09:42:00Z", "2026-05-16T12:12:00Z")), 150);
});

test("a stop that has not departed yet has no measured waiting time", async () => {
  const { stopWaitingMinutes, derivedWaitingCategory } = await workflow();
  assert.equal(stopWaitingMinutes(stop("2026-05-16T09:42:00Z")), null);
  assert.equal(stopWaitingMinutes(stop()), null);
  assert.equal(derivedWaitingCategory(stop("2026-05-16T09:42:00Z")), null);
});

test("out of order or unparseable timestamps never produce a waiting time", async () => {
  const { stopWaitingMinutes } = await workflow();
  assert.equal(stopWaitingMinutes(stop("2026-05-16T10:00:00Z", "2026-05-16T09:42:00Z")), null);
  assert.equal(stopWaitingMinutes(stop("not-a-time", "2026-05-16T09:42:00Z")), null);
});

test("measured minutes map onto the waiting bands", async () => {
  const { waitingCategoryFromMinutes } = await workflow();
  assert.equal(waitingCategoryFromMinutes(0), "quick");
  assert.equal(waitingCategoryFromMinutes(44), "quick");
  assert.equal(waitingCategoryFromMinutes(45), "standard");
  assert.equal(waitingCategoryFromMinutes(119), "standard");
  assert.equal(waitingCategoryFromMinutes(120), "long");
  assert.equal(waitingCategoryFromMinutes(239), "long");
  assert.equal(waitingCategoryFromMinutes(240), "extremely_delayed");
  assert.equal(waitingCategoryFromMinutes(600), "extremely_delayed");
});

test("the grade a stop earns for waiting follows from the measured duration", async () => {
  const { derivedWaitingCategory } = await workflow();
  const { WAITING_CATEGORY_SCORES } = await import("../app/v2/workflow/experience.ts");
  const measured = (minutes: number) =>
    stop("2026-05-16T09:00:00Z", new Date(Date.parse("2026-05-16T09:00:00Z") + minutes * 60000).toISOString());

  assert.equal(WAITING_CATEGORY_SCORES[derivedWaitingCategory(measured(18))!], 5);
  assert.equal(WAITING_CATEGORY_SCORES[derivedWaitingCategory(measured(90))!], 4);
  assert.equal(WAITING_CATEGORY_SCORES[derivedWaitingCategory(measured(180))!], 2);
  assert.equal(WAITING_CATEGORY_SCORES[derivedWaitingCategory(measured(330))!], 1);
});

test("a measured wait reads back to the driver in plain units", async () => {
  const { formatWaitingDuration } = await workflow();
  assert.equal(formatWaitingDuration(18), "18 min");
  assert.equal(formatWaitingDuration(60), "1 hr");
  assert.equal(formatWaitingDuration(75), "1 hr 15 min");
});

test("recording arrive and depart stamps the stop the driver acted on", async () => {
  const { MemoryWorkdayRepository } = await import("../app/v2/server/memory-workday-repository.ts");
  const repository = new MemoryWorkdayRepository();
  const write = (key: string, now: string) => ({ driverId: "driver-1", key, operation: "test", now });
  const aggregate = {
    id: "day-1",
    state: "active" as const,
    activeStopIndex: 0,
    equipment: { type: "tractor" as const, truckNumber: "124", trailerType: "dry_van" as const, odometer: "125560" },
    stops: [
      { ...stop(), id: "stop-1", state: "pending" as const },
      { ...stop(), id: "stop-2", providerId: "osm:node:2", displayName: "ABC Manufacturing", address: "567 Industrial Dr", order: 1, state: "pending" as const },
    ],
  };
  await repository.start(aggregate, "2026-05-16", write("start-1", "2026-05-16T09:00:00Z"));

  await repository.recordStopEvent("stop-1", "navigate", "pending", "navigating", write("nav-1", "2026-05-16T09:20:00Z"));
  await repository.recordStopEvent("stop-1", "arrive", "navigating", "arrived", write("arr-1", "2026-05-16T09:42:00Z"));
  const departed = await repository.recordStopEvent("stop-1", "depart", "arrived", "departed", write("dep-1", "2026-05-16T10:00:00Z"));

  const { stopWaitingMinutes, derivedWaitingCategory } = await workflow();
  assert.equal(departed.stops[0].arrivedAt, "2026-05-16T09:42:00Z");
  assert.equal(departed.stops[0].departedAt, "2026-05-16T10:00:00Z");
  assert.equal(stopWaitingMinutes(departed.stops[0]), 18);
  assert.equal(derivedWaitingCategory(departed.stops[0]), "quick");
  assert.equal(departed.stops[1].arrivedAt, undefined);
  assert.equal(departed.stops[1].departedAt, undefined);
});

test("a driver is greeted by name only when a real name is known", async () => {
  const { driverFirstName } = await workflow();
  assert.equal(driverFirstName("Jose Martinez"), "Jose");
  assert.equal(driverFirstName("  Jose  "), "Jose");
  assert.equal(driverFirstName("jose@stopscore.test"), null);
  assert.equal(driverFirstName(""), null);
  assert.equal(driverFirstName(null), null);
  assert.equal(driverFirstName(undefined), null);
});

test("a recorded arrival reads back as wall-clock time", async () => {
  const { formatClockTime } = await workflow();
  assert.match(formatClockTime("2026-05-16T09:42:00Z") ?? "", /\d{1,2}:\d{2}\s?(AM|PM)/);
  assert.equal(formatClockTime(undefined), null);
  assert.equal(formatClockTime("not-a-time"), null);
});

test("time at a stop keeps counting until the driver departs", async () => {
  const { minutesSinceArrival } = await workflow();
  const arrived = "2026-05-16T09:42:00Z";
  const now = Date.parse("2026-05-16T10:00:00Z");
  assert.equal(minutesSinceArrival(stop(arrived), now), 18);
  assert.equal(minutesSinceArrival(stop(arrived, "2026-05-16T10:00:00Z"), now), null);
  assert.equal(minutesSinceArrival(stop(), now), null);
});
