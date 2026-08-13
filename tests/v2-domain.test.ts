import assert from "node:assert/strict";
import test from "node:test";

const domainModule = "../app/v2/domain/workday.ts";

async function loadDomain() {
  try {
    return await import(domainModule);
  } catch (error) {
    assert.fail(`v2 workday domain must exist before these contracts can pass: ${String(error)}`);
  }
}

test("publishes the canonical equipment, stop, experience, and waiting contracts", async () => {
  const domain = await loadDomain();

  assert.deepEqual(domain.EQUIPMENT_TYPES, ["tractor", "bobtail", "straight_truck", "box_truck", "small_box_truck", "cargo_van"]);
  assert.deepEqual(domain.TRACTOR_TRAILER_TYPES, ["dry_van", "reefer", "flatbed", "step_deck", "tanker", "other"]);
  assert.deepEqual(domain.STOP_TYPES, ["delivery", "pickup", "drop_hook", "delivery_pickup"]);
  assert.deepEqual(domain.EXPERIENCE_TOPICS, [
    { key: "yard", label: "Yard Experience" },
    { key: "staging", label: "Staging" },
    { key: "staff", label: "Staff Experience" },
    { key: "waitingTime", label: "Waiting Time" },
    { key: "bathroomAccess", label: "Bathroom Access" },
  ]);
  assert.deepEqual(domain.WAITING_CATEGORIES, ["quick", "standard", "long", "extremely_delayed"]);
});

test("equipment validation requires tractor trailer information and rejects noncanonical values", async () => {
  const { validateEquipment } = await loadDomain();

  assert.deepEqual(validateEquipment({
    type: "tractor",
    truckNumber: "T-42",
    trailerNumber: "R-9",
    trailerType: "reefer",
    odometer: "120005",
  }), {
    type: "tractor",
    truckNumber: "T-42",
    trailerNumber: "R-9",
    trailerType: "reefer",
    odometer: "120005",
  });

  assert.throws(
    () => validateEquipment({ type: "tractor", truckNumber: "T-42", odometer: "120005" }),
    error => error instanceof Error && error.name === "ValidationError",
  );
  assert.deepEqual(validateEquipment({
    type: "tractor",
    truckNumber: "T-42",
    trailerType: "reefer",
    odometer: "120005",
  }), {
    type: "tractor",
    truckNumber: "T-42",
    trailerType: "reefer",
    odometer: "120005",
  });
  assert.deepEqual(validateEquipment({ type: "box_truck", truckNumber: "B-1", odometer: "1" }), { type: "box_truck", truckNumber: "B-1", odometer: "1" });
  assert.deepEqual(validateEquipment({ type: "small_box_truck", truckNumber: "SB-8", odometer: "1200" }), { type: "small_box_truck", truckNumber: "SB-8", odometer: "1200" });
  assert.throws(() => validateEquipment({ type: "small_box_truck", truckNumber: "SB-8", odometer: "1200", trailerType: "reefer" }), /only valid for a tractor/);
});

test("route validation accepts ordered canonical OSM stops and rejects fabricated identities", async () => {
  const { validateRoute } = await loadDomain();
  const valid = [
    {
      providerId: "osm:node:123",
      displayName: "Receiver One",
      address: "100 Main St, Buffalo, NY 14202",
      type: "delivery",
      order: 0,
    },
    {
      providerId: "osm:way:987654321",
      displayName: "Shipper Two",
      address: "200 Lake Ave, Rochester, NY 14604",
      type: "pickup",
      order: 1,
    },
  ];

  assert.deepEqual(validateRoute(valid), valid);
  for (const providerId of [
    "place-123",
    "osm:place:123",
    "osm:node:0",
    "osm:node:0123",
    "osm:node:-2",
    "osm:node:1.5",
  ]) {
    assert.throws(
      () => validateRoute([{ ...valid[0], providerId }]),
      error => error instanceof Error && error.name === "ValidationError",
      providerId,
    );
  }
  assert.throws(
    () => validateRoute([{ ...valid[0], order: 1 }]),
    error => error instanceof Error && error.name === "ValidationError",
  );
  assert.throws(
    () => validateRoute([valid[0], { ...valid[1], providerId: valid[0].providerId }]),
    error => error instanceof Error && error.name === "ValidationError",
  );
});

test("stop transitions allow only navigate, arrive, depart, and committed experience progression", async () => {
  const { transitionStop, markExperiencePublished } = await loadDomain();

  assert.equal(transitionStop("pending", "navigate"), "navigating");
  assert.equal(transitionStop("navigating", "arrive"), "arrived");
  assert.equal(transitionStop("arrived", "depart"), "departed");
  assert.equal(markExperiencePublished("departed"), "experience_published");
  assert.throws(() => transitionStop("pending", "arrive"), { name: "ConflictError" });
  assert.throws(() => transitionStop("arrived", "navigate"), { name: "ConflictError" });
  assert.throws(() => markExperiencePublished("arrived"), { name: "ConflictError" });
});

test("aggregate advancement is server-authoritative and completion requires every experience", async () => {
  const { advanceAfterExperience, completeAggregate } = await loadDomain();
  const aggregate = {
    id: "wd-1",
    state: "active",
    activeStopIndex: 0,
    equipment: { type: "cargo_van", truckNumber: "V-7", odometer: "900" },
    stops: [
      { id: "stop-1", providerId: "osm:node:11", displayName: "One", address: "1 Main St", type: "delivery", order: 0, state: "departed" },
      { id: "stop-2", providerId: "osm:way:22", displayName: "Two", address: "2 Main St", type: "pickup", order: 1, state: "pending" },
    ],
  } as const;

  const advanced = advanceAfterExperience(aggregate, "stop-1");
  assert.equal(advanced.activeStopIndex, 1);
  assert.equal(advanced.stops[0].state, "experience_published");
  assert.equal(aggregate.activeStopIndex, 0, "pure transition must not mutate the prior aggregate");
  assert.throws(() => completeAggregate(advanced), { name: "ConflictError" });

  const ready = advanceAfterExperience({
    ...advanced,
    stops: [advanced.stops[0], { ...advanced.stops[1], state: "departed" }],
  }, "stop-2");
  const completed = completeAggregate(ready);
  assert.equal(completed.state, "completed");
  assert.equal(completed.activeStopIndex, 2);
});
