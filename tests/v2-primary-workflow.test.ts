import assert from "node:assert/strict";
import test from "node:test";
import type { ExperienceInput, WorkdayAggregate } from "../app/v2/domain/workday.ts";

async function loadWorkflow() {
  try {
    const [model, experience, client, http, repository] = await Promise.all([
      import("../app/v2/workflow/model.ts"),
      import("../app/v2/workflow/experience.ts"),
      import("../app/v2/workflow/client.ts"),
      import("../app/v2/server/http.ts"),
      import("../app/v2/server/memory-workday-repository.ts"),
    ]);
    return { ...model, ...experience, ...client, ...http, ...repository };
  } catch (error) {
    assert.fail(`Task 3 production workflow modules must exist: ${String(error)}`);
  }
}

const aggregate = (stopState: WorkdayAggregate["stops"][number]["state"] = "pending", activeStopIndex = 0): WorkdayAggregate => ({
  id: "day-1",
  state: "active",
  activeStopIndex,
  equipment: { type: "tractor", truckNumber: "TRK-7", trailerType: "reefer", trailerNumber: "TRL-8", odometer: "44100" },
  stops: [
    { id: "stop-1", providerId: "osm:node:1", displayName: "North Dock", address: "  10   Main St, Buffalo, NY  ", type: "drop_hook", order: 0, state: stopState },
    { id: "stop-2", providerId: "osm:node:2", displayName: "South Dock", address: "20 State St, Buffalo, NY", type: "delivery", order: 1, state: "pending" },
  ],
});

const validExperience: ExperienceInput = {
  scores: { yard: 4, staging: 3, staff: 5, waitingTime: 2, bathroomAccess: 1 },
  waitingCategory: "standard",
  bathroom: { available: false, condition: null },
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

test("Work Mode exposes only each legal action, exact equipment order, Drop & Hook labels, and normalized navigation", async () => {
  const { DROP_HOOK_DETAIL_LABELS, EQUIPMENT_DISPLAY_ORDER, getWorkModeAction, navigationTarget } = await loadWorkflow();
  assert.deepEqual((["pending", "navigating", "arrived", "departed"] as const).map(state => getWorkModeAction(state)), [
    { kind: "event", action: "navigate", label: "Navigate" },
    { kind: "event", action: "arrive", label: "Arrive" },
    { kind: "event", action: "depart", label: "Depart" },
    { kind: "experience", label: "Add Stop Knowledge" },
  ]);
  assert.deepEqual(EQUIPMENT_DISPLAY_ORDER, ["Truck #", "Trailer Type", "TRL #", "Odometer"]);
  assert.deepEqual(DROP_HOOK_DETAIL_LABELS, ["TRL # dropped", "TRL # picked up", "Reference #"]);
  assert.deepEqual(navigationTarget("  10   Main St, Buffalo, NY  "), {
    address: "10 Main St, Buffalo, NY",
    href: "https://www.google.com/maps/search/?api=1&query=10%20Main%20St%2C%20Buffalo%2C%20NY",
  });
});

test("Stop Knowledge keeps the exact five-card order and validates scores, waiting meaning, and bathroom response", async () => {
  const { EXPERIENCE_CARD_DEFINITIONS, WAITING_OPTIONS, createExperienceDraft, setBathroomResponse, setBathroomScore, setExperienceScore, setWaitingCategory, validateExperienceDraft } = await loadWorkflow();
  assert.deepEqual(EXPERIENCE_CARD_DEFINITIONS.map((card: { key: string; label: string }) => [card.key, card.label]), [
    ["yard", "Yard Experience"],
    ["staging", "Staging"],
    ["staff", "Staff Experience"],
    ["waitingTime", "Waiting Time"],
    ["bathroomAccess", "Bathroom Access"],
  ]);
  assert.deepEqual(WAITING_OPTIONS.map((option: { label: string; meaning: string }) => [option.label, option.meaning]), [
    ["Quick", "15–45 min"], ["Standard", "30 min–1 hr"], ["Long", "1–2 hr"], ["Extremely Delayed", "2+ hr"],
  ]);

  let draft = createExperienceDraft("stop-1");
  for (const [key, score] of [["yard", 4], ["staging", 3], ["staff", 5], ["waitingTime", 2]] as const) draft = setExperienceScore(draft, key, score);
  draft = setWaitingCategory(draft, "standard");
  assert.equal(validateExperienceDraft(draft).ok, false);
  draft = setBathroomResponse(draft, "no");
  draft = setBathroomScore(draft, 1);
  const noBathroom = validateExperienceDraft(draft);
  assert.equal(noBathroom.ok, true);
  if (noBathroom.ok) {
    assert.equal(noBathroom.summary, "No bathroom access");
    assert.equal(noBathroom.input.scores.bathroomAccess, 1);
    assert.deepEqual(noBathroom.input.bathroom, { available: false, condition: null });
  }
  draft = setBathroomResponse(draft, "yes", "clean");
  draft = setBathroomScore(draft, 5);
  const clean = validateExperienceDraft(draft);
  assert.equal(clean.ok, true);
  if (clean.ok) assert.equal(clean.input.scores.bathroomAccess, 5);
  assert.throws(() => setExperienceScore(draft, "yard", 2.5), /whole number/);
});

test("waiting and bathroom choices derive their required integer scores", async () => {
  const { createExperienceDraft, setWaitingCategory, setBathroomResponse } = await loadWorkflow();
  let draft = createExperienceDraft("stop-1");
  draft = setWaitingCategory(draft, "quick");
  assert.equal(draft.scores.waitingTime, 5);
  draft = setWaitingCategory(draft, "extremely_delayed");
  assert.equal(draft.scores.waitingTime, 1);
  draft = setBathroomResponse(draft, "no");
  assert.equal(draft.scores.bathroomAccess, 1);
  draft = setBathroomResponse(draft, "yes", "clean");
  assert.equal(draft.scores.bathroomAccess, 5);
  draft = setBathroomResponse(draft, "yes", "dirty");
  assert.equal(draft.scores.bathroomAccess, 2);
});

test("experience publishing preserves one idempotency key across a failed retry", async () => {
  const { createExperiencePublishSession, createExperienceState, reduceExperienceState, setExperienceScore } = await loadWorkflow();
  const keys: string[] = [];
  let attempts = 0;
  const session = createExperiencePublishSession({
    stopId: "stop-1",
    keyFactory: () => "experience-key-1",
    publish: async (_stopId: string, _input: ExperienceInput, key: string) => {
      keys.push(key);
      attempts += 1;
      if (attempts === 1) throw new Error("offline");
      return aggregate("experience_published", 1);
    },
  });
  await assert.rejects(session.publish(validExperience), /offline/);
  assert.equal(session.idempotencyKey, "experience-key-1");
  const result = await session.publish(validExperience);
  assert.equal(result.activeStopIndex, 1);
  assert.deepEqual(keys, ["experience-key-1", "experience-key-1"]);

  let state = createExperienceState("stop-1");
  state = reduceExperienceState(state, { type: "replace-draft", draft: setExperienceScore(state.draft, "yard", 4) });
  const retainedDraft = state.draft;
  state = reduceExperienceState(state, { type: "publish-start" });
  state = reduceExperienceState(state, { type: "publish-failure", message: "offline" });
  assert.equal(state.draft, retainedDraft);
  assert.equal(state.status, "error");
  assert.equal(state.error, "offline");
});

test("mutation client rejects null and malformed workdays without replacing mounted authority", async () => {
  const { createWorkflowMutationClient } = await loadWorkflow();
  const applied: WorkdayAggregate[] = [];
  let response: Response = Response.json({ workday: null });
  const client = createWorkflowMutationClient({
    fetcher: async () => response,
    keyFactory: () => "key-1",
    onCurrentWorkday: (workday: WorkdayAggregate) => applied.push(workday),
  });
  await assert.rejects(client.event("stop-1", "navigate"), /authoritative workday/);
  response = Response.json({ workday: { id: "broken", state: "active", stops: "nope" } });
  await assert.rejects(client.event("stop-1", "navigate"), /authoritative workday/);
  response = Response.json({ workday: { ...aggregate(), activeStopIndex: 99 } });
  await assert.rejects(client.event("stop-1", "navigate"), /authoritative workday/);
  assert.deepEqual(applied, []);
});

test("publish applies the server's exact non-local activeStopIndex and never increments locally", async () => {
  const { createWorkflowMutationClient } = await loadWorkflow();
  const returned = aggregate("experience_published", 7);
  returned.stops = Array.from({ length: 8 }, (_, index) => ({
    id: `stop-${index + 1}`,
    providerId: `osm:node:${index + 1}`,
    displayName: `Stop ${index + 1}`,
    address: `${index + 1} Main St`,
    type: "delivery" as const,
    order: index,
    state: index < 7 ? "experience_published" as const : "pending" as const,
  }));
  const applied: WorkdayAggregate[] = [];
  const client = createWorkflowMutationClient({
    fetcher: async () => Response.json({ workday: returned }),
    keyFactory: () => "event-key",
    onCurrentWorkday: (workday: WorkdayAggregate) => applied.push(workday),
  });
  const result = await client.publish("stop-1", validExperience, "draft-key");
  assert.equal(result.activeStopIndex, 7);
  assert.equal(applied[0].activeStopIndex, 7);
});

test("a delayed older mutation cannot overwrite a newer authoritative aggregate", async () => {
  const { createWorkflowMutationClient } = await loadWorkflow();
  const oldResponse = deferred<Response>();
  const applied: WorkdayAggregate[] = [];
  let request = 0;
  const newer = aggregate("experience_published", 1);
  newer.stops[1].state = "arrived";
  const client = createWorkflowMutationClient({
    fetcher: async () => ++request === 1 ? oldResponse.promise : Response.json({ workday: newer }),
    keyFactory: () => `key-${request + 1}`,
    onCurrentWorkday: (workday: WorkdayAggregate) => applied.push(workday),
  });
  const old = client.event("stop-1", "navigate");
  const current = await client.event("stop-1", "arrive");
  oldResponse.resolve(Response.json({ workday: aggregate("navigating", 0) }));
  await assert.rejects(old, /stale/i);
  assert.equal(current.activeStopIndex, 1);
  assert.deepEqual(applied.map(item => item.activeStopIndex), [1]);
});

test("the real authenticated boundary completes one stop and retains the finished summary", async () => {
  const { createExperiencePublishSession, createWorkflowHttpHandlers, createWorkflowMutationClient, MemoryWorkdayRepository } = await loadWorkflow();
  const repository = new MemoryWorkdayRepository();
  const handlers = createWorkflowHttpHandlers({ authenticate: async () => ({ email: "driver@example.com" }), createRepository: async () => repository });
  const startedResponse = await handlers.postWorkday(new Request("https://app.local/api/v2/workday", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "start" }, body: JSON.stringify({ action: "start", equipment: { type: "cargo_van", truckNumber: "V-2", odometer: "100" }, stops: [{ providerId: "osm:node:9", displayName: "Dock", address: "9 Main St", type: "delivery", order: 0 }] }) }));
  const started = (await startedResponse.json() as { workday: WorkdayAggregate }).workday;
  const applied: WorkdayAggregate[] = [];
  let key = 0;
  const client = createWorkflowMutationClient({
    keyFactory: () => `mutation-${++key}`,
    onCurrentWorkday: (workday: WorkdayAggregate) => applied.push(workday),
    fetcher: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(typeof input === "string" ? `https://app.local${input}` : input, init);
      if (request.url.endsWith("/experience")) return handlers.postExperience(request, started.stops[0].id);
      if (request.url.endsWith("/events")) return handlers.postStopEvent(request, started.stops[0].id);
      return handlers.postWorkday(request);
    },
  });
  await client.event(started.stops[0].id, "navigate");
  await client.event(started.stops[0].id, "arrive");
  await client.event(started.stops[0].id, "depart");
  const publishSession = createExperiencePublishSession({ stopId: started.stops[0].id, keyFactory: () => "experience-1", publish: client.publish });
  const published = await publishSession.publish(validExperience);
  assert.equal(published.activeStopIndex, 1);
  const finished = await client.finish(started.id);
  assert.equal(finished.state, "completed");
  assert.equal(finished.stops.length, 1);
  assert.equal(finished.stops[0].state, "experience_published");
  assert.equal(applied.at(-1)?.id, started.id);
});

test("focus and announcement resolution is deterministic for Work Mode, Stop Knowledge, next stop, and Finish Day", async () => {
  const { resolveWorkflowPresentation } = await loadWorkflow();
  assert.deepEqual(resolveWorkflowPresentation(aggregate("pending", 0)), { focusId: "workmode-stop-1-action", announcement: "Stop 1 of 2. North Dock. Navigate." });
  assert.deepEqual(resolveWorkflowPresentation(aggregate("departed", 0)), { focusId: "experience-stop-1-yard", announcement: "Stop Knowledge for North Dock." });
  const next = aggregate("experience_published", 1);
  assert.deepEqual(resolveWorkflowPresentation(next), { focusId: "workmode-stop-2-action", announcement: "Stop 2 of 2. South Dock. Navigate." });
  const readyToFinish = { ...next, activeStopIndex: 2 };
  assert.deepEqual(resolveWorkflowPresentation(readyToFinish), { focusId: "finish-day-title", announcement: "All 2 stops are complete. Finish your workday." });
  assert.deepEqual(resolveWorkflowPresentation({ ...next, state: "completed", activeStopIndex: 2 }), { focusId: "finish-day-title", announcement: "Workday complete. 2 stops finished." });
});
