import assert from "node:assert/strict";
import test from "node:test";
import type { ExperienceInput, WorkdayAggregate } from "../app/v2/domain/workday.ts";

async function modules() {
  const [client, experience, recovery, http, repository] = await Promise.all([
    import("../app/v2/workflow/client.ts"),
    import("../app/v2/workflow/experience.ts"),
    import("../app/v2/workflow/experience-recovery.ts"),
    import("../app/v2/server/http.ts"),
    import("../app/v2/server/memory-workday-repository.ts"),
  ]);
  return { ...client, ...experience, ...recovery, ...http, ...repository };
}

const input: ExperienceInput = {
  scores: { yard: 4, staging: 3, staff: 5, waitingTime: 2, bathroomAccess: 4 },
  waitingCategory: "standard",
  bathroom: { available: true, condition: "clean" },
};

async function boundary() {
  const { createWorkflowHttpHandlers, MemoryWorkdayRepository } = await modules();
  const repository = new MemoryWorkdayRepository();
  const handlers = createWorkflowHttpHandlers({ authenticate: async () => ({ email: "driver@example.com" }), createRepository: async () => repository });
  const response = await handlers.postWorkday(new Request("https://app.local/api/v2/workday", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "start" }, body: JSON.stringify({ action: "start", equipment: { type: "cargo_van", truckNumber: "V-1", odometer: "10" }, stops: [{ providerId: "osm:node:91", displayName: "Dock", address: "91 Main St", type: "delivery", order: 0 }] }) }));
  const started = (await response.json() as { workday: WorkdayAggregate }).workday;
  return { handlers, repository, started };
}

test("Arrive, Depart, Publish, and Finish retries replay one logical key after commit-plus-lost-response", async () => {
  const { createWorkflowMutationClient } = await modules();
  const { handlers, repository, started } = await boundary();
  const keys: string[] = [];
  let keyNumber = 0;
  const loseOnce = new Set(["navigate", "arrive", "depart", "experience", "finish"]);
  const client = createWorkflowMutationClient({
    keyFactory: () => `logical-${++keyNumber}`,
    onCurrentWorkday: () => undefined,
    fetcher: async (value, init) => {
      const request = new Request(typeof value === "string" ? `https://app.local${value}` : value, init);
      keys.push(request.headers.get("Idempotency-Key") ?? "");
      if (request.url.endsWith("/events")) {
        const body = await request.clone().json() as { action: string };
        const committed = await handlers.postStopEvent(request, started.stops[0].id);
        if (loseOnce.delete(body.action)) throw new TypeError(`response lost after ${body.action} commit`);
        return committed;
      }
      if (request.url.endsWith("/experience")) {
        const committed = await handlers.postExperience(request, started.stops[0].id);
        if (loseOnce.delete("experience")) throw new TypeError("response lost after experience commit");
        return committed;
      }
      const committed = await handlers.postWorkday(request);
      if (loseOnce.delete("finish")) throw new TypeError("response lost after finish commit");
      return committed;
    },
  });

  for (const [index, action] of (["navigate", "arrive", "depart"] as const).entries()) {
    await assert.rejects(client.event(started.stops[0].id, action), new RegExp(`response lost after ${action}`));
    await client.event(started.stops[0].id, action);
    assert.deepEqual(keys.slice(index * 2, index * 2 + 2), [`logical-${index + 1}`, `logical-${index + 1}`]);
  }
  await assert.rejects(client.publish(started.stops[0].id, input, "experience-fixed"), /response lost after experience/);
  const published = await client.publish(started.stops[0].id, input, "experience-fixed");
  assert.equal(published.activeStopIndex, 1);
  assert.deepEqual(keys.slice(6, 8), ["experience-fixed", "experience-fixed"]);
  await assert.rejects(client.finish(started.id), /response lost/);
  const finished = await client.finish(started.id);
  assert.equal(finished.state, "completed");
  assert.deepEqual(keys.slice(-2), ["logical-4", "logical-4"]);
  assert.equal((await repository.getCurrent("driver@example.com"))?.state, "completed");
});

test("authoritative validation rejects well-shaped but impossible state/index progressions", async () => {
  const { createWorkdayStartClient } = await import("../app/v2/workday-client.ts");
  const { isAuthoritativeWorkday } = await modules();
  const { started } = await boundary();
  const pending = started.stops[0];
  assert.equal(isAuthoritativeWorkday({ ...started, state: "completed", activeStopIndex: 0 }), false);
  assert.equal(isAuthoritativeWorkday({ ...started, state: "completed", activeStopIndex: 0, stops: [] }), false);
  assert.equal(isAuthoritativeWorkday({ ...started, state: "completed", activeStopIndex: 1 }), false);
  assert.equal(isAuthoritativeWorkday({ ...started, state: "active", activeStopIndex: 1 }), false);
  assert.equal(isAuthoritativeWorkday({ ...started, state: "setup", activeStopIndex: 0, stops: [{ ...pending, state: "navigating" }] }), false);
  assert.equal(isAuthoritativeWorkday(started), true);
  assert.equal(isAuthoritativeWorkday({ ...started, state: "completed", activeStopIndex: 1, stops: [{ ...pending, state: "experience_published" }] }), true);
  let applied = 0;
  const startClient = createWorkdayStartClient({
    fetcher: async () => Response.json({ workday: { ...started, state: "active", activeStopIndex: 1 } }, { status: 201 }),
    keyFactory: () => "start-impossible",
    onCurrentWorkday: () => { applied += 1; },
  });
  await assert.rejects(startClient.start({ equipment: started.equipment, stops: started.stops.map(stop => ({ providerId: stop.providerId, displayName: stop.displayName, address: stop.address, type: stop.type, order: stop.order })) }), /start your workday/);
  assert.equal(applied, 0);
});

test("versioned Stop Knowledge recovery retains all five answers and its retry identity across remount", async () => {
  const { createExperienceState, createExperienceRecoveryRecord, loadExperienceRecovery, reduceExperienceState, saveExperienceRecovery, setBathroomResponse, setBathroomScore, setExperienceScore, setWaitingCategory } = await modules();
  let state = createExperienceState("stop-1");
  let draft = state.draft;
  for (const [key, score] of [["yard", 4], ["staging", 3], ["staff", 5], ["waitingTime", 2]] as const) draft = setExperienceScore(draft, key, score);
  draft = setWaitingCategory(draft, "long");
  draft = setBathroomResponse(draft, "yes", "needs_improvement");
  draft = setBathroomScore(draft, 3);
  state = reduceExperienceState(state, { type: "replace-draft", draft });
  const record = createExperienceRecoveryRecord({ workdayId: "day-1", draft: state.draft, idempotencyKey: "experience-key-77", now: 1000 });
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); } };
  assert.equal(saveExperienceRecovery(storage, record), true);
  const remounted = loadExperienceRecovery(storage, "day-1", "stop-1", 1001);
  assert.deepEqual(remounted, record);
  assert.equal(remounted?.idempotencyKey, "experience-key-77");
  assert.deepEqual(remounted?.draft, draft);
});

test("bathroom answers derive a consistent authoritative score and detail", async () => {
  const { createExperienceDraft, setBathroomResponse, setExperienceScore, setWaitingCategory, validateExperienceDraft } = await modules();
  let draft = createExperienceDraft("stop-1");
  for (const [key, score] of [["yard", 4], ["staging", 3], ["staff", 5], ["waitingTime", 2]] as const) draft = setExperienceScore(draft, key, score);
  draft = setWaitingCategory(draft, "quick");
  draft = setBathroomResponse(draft, "no");
  const noBathroom = validateExperienceDraft(draft);
  assert.equal(noBathroom.ok, true);
  if (noBathroom.ok) {
    assert.equal(noBathroom.input.scores.bathroomAccess, 1);
    assert.deepEqual(noBathroom.input.bathroom, { available: false, condition: null });
  }

  draft = setBathroomResponse(draft, "yes");
  assert.equal(validateExperienceDraft(draft).ok, false);
  draft = setBathroomResponse(draft, "yes", "dirty");
  const dirty = validateExperienceDraft(draft);
  assert.equal(dirty.ok, true);
  if (dirty.ok) {
    assert.equal(dirty.input.scores.bathroomAccess, 2);
    assert.deepEqual(dirty.input.bathroom, { available: true, condition: "dirty" });
  }
});

test("a complete scored draft still requires an explicit consistent bathroom answer", async () => {
  const { createExperienceDraft, setBathroomResponse, setBathroomScore, setExperienceScore, setWaitingCategory, validateExperienceDraft } = await modules();
  let draft = createExperienceDraft("stop-1");
  for (const [key, score] of [["yard", 4], ["staging", 3], ["staff", 5], ["waitingTime", 2]] as const) draft = setExperienceScore(draft, key, score);
  draft = setWaitingCategory(draft, "standard");
  draft = setBathroomScore(draft, 4);

  const unanswered = validateExperienceDraft(draft);
  assert.deepEqual(unanswered, { ok: false, message: "Choose Yes or No for bathroom availability.", firstKey: "bathroomAccess" });

  const inconsistentNo = validateExperienceDraft({ ...setBathroomResponse(draft, "no"), bathroomCondition: "dirty" });
  assert.deepEqual(inconsistentNo, { ok: false, message: "Bathroom condition must be empty when no bathroom is available.", firstKey: "bathroomAccess" });

  const missingYesCondition = validateExperienceDraft(setBathroomResponse(draft, "yes"));
  assert.deepEqual(missingYesCondition, { ok: false, message: "Choose the bathroom condition.", firstKey: "bathroomAccess" });
});

test("recovery fails closed when a bathroom score has no answer or answer and condition conflict", async () => {
  const { createExperienceDraft, createExperienceRecoveryRecord, loadExperienceRecovery, saveExperienceRecovery, setBathroomScore, setExperienceScore, setWaitingCategory } = await modules();
  let draft = createExperienceDraft("stop-1");
  for (const [key, score] of [["yard", 4], ["staging", 3], ["staff", 5], ["waitingTime", 2]] as const) draft = setExperienceScore(draft, key, score);
  draft = setWaitingCategory(draft, "standard");
  draft = setBathroomScore(draft, 4);
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); } };

  for (const invalidDraft of [draft, { ...draft, bathroomAnswer: "no" as const, bathroomCondition: "dirty" as const }, { ...draft, bathroomAnswer: "yes" as const, bathroomCondition: null }]) {
    saveExperienceRecovery(storage, createExperienceRecoveryRecord({ workdayId: "day-invalid", draft: invalidDraft, idempotencyKey: "publish-invalid", now: 1000 }));
    assert.equal(loadExperienceRecovery(storage, "day-invalid", "stop-1", 1001), null);
    assert.equal(memory.size, 0);
  }
});

test("bathroom summary reports the explicit persisted answer and condition, never the numeric score", async () => {
  const { createExperienceDraft, setBathroomResponse, setBathroomScore, setExperienceScore, setWaitingCategory, validateExperienceDraft } = await modules();
  let draft = createExperienceDraft("stop-1");
  for (const [key, score] of [["yard", 4], ["staging", 3], ["staff", 5], ["waitingTime", 2]] as const) draft = setExperienceScore(draft, key, score);
  draft = setWaitingCategory(draft, "standard");

  const noBathroom = validateExperienceDraft(setBathroomScore(setBathroomResponse(draft, "no"), 5));
  assert.equal(noBathroom.ok && noBathroom.summary, "No bathroom access");

  const cleanBathroom = validateExperienceDraft(setBathroomScore(setBathroomResponse(draft, "yes", "clean"), 1));
  assert.equal(cleanBathroom.ok && cleanBathroom.summary, "Clean");

  const dirtyBathroom = validateExperienceDraft(setBathroomScore(setBathroomResponse(draft, "yes", "dirty"), 5));
  assert.equal(dirtyBathroom.ok && dirtyBathroom.summary, "Dirty");
});
