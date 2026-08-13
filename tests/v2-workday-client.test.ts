import assert from "node:assert/strict";
import test from "node:test";
import type { Equipment, RouteStopInput, WorkdayAggregate } from "../app/v2/domain/workday.ts";

async function loadClient() {
  try {
    const [client, http, repository] = await Promise.all([
      import("../app/v2/workday-client.ts"),
      import("../app/v2/server/http.ts"),
      import("../app/v2/server/memory-workday-repository.ts"),
    ]);
    return { ...client, ...http, ...repository };
  } catch (error) {
    assert.fail(`Task 2 client/server start boundary must exist: ${String(error)}`);
  }
}

const stop = (providerId: string, order = 0): RouteStopInput => ({ providerId, displayName: providerId, address: `${order + 1} Main St`, type: "delivery", order });
const payload = (truckNumber: string, providerId: string) => ({
  equipment: { type: "cargo_van", truckNumber, odometer: "100" } satisfies Equipment,
  stops: [stop(providerId)],
});
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function createBoundary(transport: (request: Request, post: (request: Request) => Promise<Response>) => Promise<Response>) {
  const { createWorkdayStartClient, createWorkflowHttpHandlers, MemoryWorkdayRepository } = await loadClient();
  const repository = new MemoryWorkdayRepository();
  const handlers = createWorkflowHttpHandlers({
    authenticate: async () => ({ email: "driver@example.com" }),
    createRepository: async () => repository,
  });
  const keys: string[] = [];
  const applied: WorkdayAggregate[] = [];
  let keyNumber = 0;
  const client = createWorkdayStartClient({
    fetcher: async (input, init) => {
      const request = new Request(typeof input === "string" ? `https://app.local${input}` : input, init);
      keys.push(request.headers.get("Idempotency-Key") ?? "");
      return transport(request, handlers.postWorkday);
    },
    keyFactory: () => `start-key-${++keyNumber}`,
    onCurrentWorkday: workday => applied.push(workday),
  });
  return { applied, client, keys, repository };
}

test("an authoritative first start suppresses an edited queued POST and is surfaced to both callers", async () => {
  const gate = deferred<void>();
  let posts = 0;
  const boundary = await createBoundary(async (request, post) => {
    posts += 1;
    await gate.promise;
    return post(request);
  });
  const firstPayload = payload("OLD", "osm:node:1");
  const editedPayload = payload("EDITED", "osm:node:2");
  const first = boundary.client.start(firstPayload);
  const edited = boundary.client.start(editedPayload);
  assert.equal(posts, 1, "an edited intent must wait behind the active POST");

  gate.resolve();
  const [firstResult, editedResult] = await Promise.all([first, edited]);
  const serverCurrent = await boundary.repository.getCurrent("driver@example.com");
  assert.equal(posts, 1, "authoritative success must suppress the queued start");
  assert.equal(firstResult.id, editedResult.id);
  assert.equal(editedResult.equipment.truckNumber, "OLD");
  assert.equal(serverCurrent?.id, editedResult.id);
  assert.equal(boundary.applied.length, 1);
  assert.equal(boundary.applied[0].id, editedResult.id);
});

test("a definitive first rejection serializes the newest edited intent and server/UI both use that setup", async () => {
  const firstGate = deferred<void>();
  let posts = 0;
  const boundary = await createBoundary(async (request, post) => {
    posts += 1;
    if (posts === 1) {
      await firstGate.promise;
      return Response.json({ error: { message: "unavailable before service" } }, { status: 503 });
    }
    return post(request);
  });
  const first = boundary.client.start(payload("OLD", "osm:node:1"));
  const firstRejected = assert.rejects(first, /unavailable before service/);
  const edited = boundary.client.start(payload("EDITED", "osm:node:2"));
  assert.equal(posts, 1);

  firstGate.resolve();
  await firstRejected;
  const editedResult = await edited;
  const serverCurrent = await boundary.repository.getCurrent("driver@example.com");
  assert.equal(posts, 2);
  assert.equal(editedResult.equipment.truckNumber, "EDITED");
  assert.equal(serverCurrent?.id, editedResult.id);
  assert.deepEqual(boundary.applied.map(workday => workday.id), [editedResult.id]);
});

test("a committed start with a lost response replays its key before a queued edit and surfaces one authority", async () => {
  let posts = 0;
  const boundary = await createBoundary(async (request, post) => {
    posts += 1;
    const response = await post(request);
    if (posts === 1) throw new TypeError("response lost after committed A");
    return response;
  });
  const first = boundary.client.start(payload("OLD", "osm:node:1"));
  const edited = boundary.client.start(payload("EDITED", "osm:node:2"));

  const [firstResult, editedResult] = await Promise.all([first, edited]);
  const serverCurrent = await boundary.repository.getCurrent("driver@example.com");
  assert.deepEqual(boundary.keys, ["start-key-1", "start-key-1"], "queued B must not allocate or send key B");
  assert.equal(posts, 2);
  assert.equal(firstResult.id, editedResult.id);
  assert.equal(serverCurrent?.id, firstResult.id);
  assert.equal(serverCurrent?.equipment.truckNumber, "OLD");
  assert.deepEqual(boundary.applied.map(workday => workday.id), [firstResult.id]);
});

test("a lost successful response retries the same payload/key and replays the committed aggregate", async () => {
  let posts = 0;
  const boundary = await createBoundary(async (request, post) => {
    posts += 1;
    const response = await post(request);
    if (posts === 1) throw new TypeError("response lost after commit");
    return response;
  });
  const committedPayload = payload("COMMITTED", "osm:way:9");
  await assert.rejects(boundary.client.start(committedPayload), /response lost after commit/);
  const committed = await boundary.repository.getCurrent("driver@example.com");
  assert.ok(committed);

  const replayed = await boundary.client.start(structuredClone(committedPayload));
  assert.equal(replayed.id, committed.id);
  assert.deepEqual(boundary.keys, ["start-key-1", "start-key-1"]);
  assert.deepEqual(boundary.applied.map(workday => workday.id), [committed.id]);
});

test("identical concurrent payloads coalesce into the same promise and one production POST", async () => {
  const gate = deferred<void>();
  let posts = 0;
  const boundary = await createBoundary(async (request, post) => {
    posts += 1;
    await gate.promise;
    return post(request);
  });
  const committedPayload = payload("SAME", "osm:node:7");
  const first = boundary.client.start(committedPayload);
  const duplicate = boundary.client.start(structuredClone(committedPayload));
  assert.equal(duplicate, first);
  assert.equal(posts, 1);
  gate.resolve();
  assert.equal((await duplicate).equipment.truckNumber, "SAME");
  assert.deepEqual(boundary.keys, ["start-key-1"]);
});

test("request lifecycle remains live after Strict Effects setup-cleanup-setup and rejects stale settlements", async () => {
  const { createRequestLifecycle } = await loadClient();
  const lifecycle = createRequestLifecycle();
  const cleanupFirstSetup = lifecycle.mount();
  const stale = lifecycle.begin();
  cleanupFirstSetup();
  const cleanupSecondSetup = lifecycle.mount();
  assert.equal(lifecycle.isCurrent(stale), false);
  const current = lifecycle.begin();
  assert.equal(lifecycle.isCurrent(current), true);
  cleanupSecondSetup();
  assert.equal(lifecycle.isCurrent(current), false);
});
