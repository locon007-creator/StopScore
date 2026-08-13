import assert from "node:assert/strict";
import test from "node:test";

async function loadHttp() {
  try {
    const [{ createWorkflowHttpHandlers }, { MemoryWorkdayRepository }] = await Promise.all([
      import("../app/v2/server/http.ts"),
      import("../app/v2/server/memory-workday-repository.ts"),
    ]);
    return { createWorkflowHttpHandlers, MemoryWorkdayRepository };
  } catch (error) {
    assert.fail(`v2 HTTP handler factory must exist: ${String(error)}`);
  }
}

const equipment = { type: "cargo_van", truckNumber: "V-17", odometer: "50100" };
const stops = [{ providerId: "osm:node:901", displayName: "Receiver", address: "100 Main St", type: "delivery", order: 0 }];
const experience = {
  scores: { yard: 5, staging: 4, staff: 3, waitingTime: 2, bathroomAccess: 1 },
  waitingCategory: "standard",
  bathroom: { available: false, condition: null },
};

function request(body: unknown, key = "request-key") {
  return new Request("https://app.local/api/v2/workday", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}

test("authentication happens before write body parsing and storage creation", async () => {
  const { createWorkflowHttpHandlers, MemoryWorkdayRepository } = await loadHttp();
  const order: string[] = [];
  const handlers = createWorkflowHttpHandlers({
    authenticate: async () => { order.push("authenticate"); return null; },
    createRepository: async () => { order.push("storage"); return new MemoryWorkdayRepository(); },
  });
  const guardedRequest = {
    headers: new Headers({ "Idempotency-Key": "key" }),
    json: async () => { order.push("body"); return { action: "start", equipment, stops }; },
  } as unknown as Request;

  const response = await handlers.postWorkday(guardedRequest);
  assert.equal(response.status, 401);
  assert.deepEqual(order, ["authenticate"]);
});

test("malformed JSON returns validation before storage creation", async () => {
  const { createWorkflowHttpHandlers, MemoryWorkdayRepository } = await loadHttp();
  const order: string[] = [];
  const handlers = createWorkflowHttpHandlers({
    authenticate: async () => { order.push("authenticate"); return { email: "driver@example.com" }; },
    createRepository: async () => { order.push("storage"); return new MemoryWorkdayRepository(); },
  });
  const malformed = {
    headers: new Headers({ "Idempotency-Key": "key" }),
    json: async () => { order.push("body"); throw new SyntaxError("private malformed detail"); },
  } as unknown as Request;

  const response = await handlers.postWorkday(malformed);
  assert.equal(response.status, 400);
  assert.deepEqual(order, ["authenticate", "body"]);
  assert.deepEqual(await response.json(), { error: { code: "validation", message: "The request body is invalid." } });
});

test("HTTP workflow exposes start, restore, event, publish, and finish aggregates", async () => {
  const { createWorkflowHttpHandlers, MemoryWorkdayRepository } = await loadHttp();
  const repository = new MemoryWorkdayRepository();
  const handlers = createWorkflowHttpHandlers({
    authenticate: async () => ({ email: "Driver@Example.com" }),
    createRepository: async () => repository,
  });

  let response = await handlers.postWorkday(request({ action: "start", equipment, stops }, "start"));
  assert.equal(response.status, 201);
  let workday = (await response.json()).workday;
  const stopId = workday.stops[0].id;

  response = await handlers.getWorkday();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).workday.id, workday.id);

  for (const action of ["navigate", "arrive", "depart"]) {
    response = await handlers.postStopEvent(request({ action }, action), stopId);
    assert.equal(response.status, 200);
    workday = (await response.json()).workday;
  }
  response = await handlers.postExperience(request(experience, "publish"), stopId);
  assert.equal(response.status, 200);
  workday = (await response.json()).workday;
  assert.equal(workday.activeStopIndex, 1);

  response = await handlers.postWorkday(request({ action: "finish", workdayId: workday.id }, "finish"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).workday.state, "completed");
});

test("HTTP maps invalid, missing, stale, and unexpected storage errors", async () => {
  const { createWorkflowHttpHandlers, MemoryWorkdayRepository } = await loadHttp();
  const repository = new MemoryWorkdayRepository();
  const handlers = createWorkflowHttpHandlers({
    authenticate: async () => ({ email: "driver@example.com" }),
    createRepository: async () => repository,
  });

  assert.equal((await handlers.postWorkday(request({ action: "start", equipment, stops: [{ ...stops[0], providerId: "fabricated" }] }, "invalid"))).status, 400);
  assert.equal((await handlers.postStopEvent(request({ action: "navigate" }, "missing"), "missing-stop")).status, 404);
  const started = await handlers.postWorkday(request({ action: "start", equipment, stops }, "start"));
  const stopId = (await started.json()).workday.stops[0].id;
  assert.equal((await handlers.postStopEvent(request({ action: "arrive" }, "stale"), stopId)).status, 409);

  const broken = createWorkflowHttpHandlers({
    authenticate: async () => ({ email: "driver@example.com" }),
    createRepository: async () => { throw new Error("D1 secret connection detail"); },
  });
  const response = await broken.getWorkday();
  assert.equal(response.status, 500);
  const body = await response.text();
  assert.equal(body, JSON.stringify({ error: { code: "storage", message: "The workday service is temporarily unavailable." } }));
  assert.doesNotMatch(body, /secret|connection|D1/i);
});
