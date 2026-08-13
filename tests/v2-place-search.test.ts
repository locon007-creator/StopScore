import assert from "node:assert/strict";
import test from "node:test";

async function loadSearch() {
  try {
    return await import("../app/v2/server/place-search.ts");
  } catch (error) {
    assert.fail(`Task 2 Photon adapter must exist: ${String(error)}`);
  }
}

const feature = (osmId: number, overrides: Record<string, unknown> = {}) => ({
  type: "Feature",
  properties: {
    osm_id: osmId,
    osm_type: "N",
    countrycode: "US",
    name: "Acme Foods",
    street: "Main Street",
    housenumber: "100",
    city: "Buffalo",
    state: "New York",
    postcode: "14202",
    type: "house",
    ...overrides,
  },
  geometry: { type: "Point", coordinates: [-78.87, 42.88] },
});

test("Photon variants are bounded, U.S.-scoped, and include direct, structured, and qualified attempts", async () => {
  const { buildPhotonAttempts } = await loadSearch();
  const attempts = buildPhotonAttempts("100 Main St, Buffalo, NY 14202");
  assert.equal(attempts.length, 3);
  assert.equal(attempts[0].searchParams.get("countrycode"), "US");
  assert.equal(attempts[0].searchParams.get("q"), "100 Main St, Buffalo, NY 14202");
  assert.match(attempts[1].pathname, /structured/);
  assert.equal(attempts[1].searchParams.get("street"), "Main St");
  assert.equal(attempts[2].searchParams.get("q"), "100 Main St, Buffalo, NY 14202, United States");
});

test("runtime parsing emits only canonical U.S. OSM identities and rejects malformed features", async () => {
  const { parsePhotonPayload } = await loadSearch();
  const parsed = parsePhotonPayload({ features: [
    feature(41, { osm_key: "amenity" }),
    feature(42, { countrycode: "CA" }),
    feature(43, { osm_type: "X" }),
    feature(44, { osm_key: "place", type: "city", name: "Buffalo", street: undefined, housenumber: undefined }),
    { nope: true },
  ] });
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.suggestions, [{
    providerId: "osm:node:41",
    displayName: "Acme Foods",
    address: "100 Main Street, Buffalo, New York 14202",
    category: "house",
    latitude: 42.88,
    longitude: -78.87,
  }]);
  assert.deepEqual(parsePhotonPayload({ nope: [] }), { ok: false });
  assert.deepEqual(parsePhotonPayload({ features: [{ nope: true }] }), { ok: false });
  assert.deepEqual(parsePhotonPayload({ features: [feature(45, { osm_key: "amenity" }), { nope: true }] }), {
    ok: true,
    suggestions: [{ providerId: "osm:node:45", displayName: "Acme Foods", address: "100 Main Street, Buffalo, New York 14202", category: "house", latitude: 42.88, longitude: -78.87 }],
  });
  assert.deepEqual(parsePhotonPayload({ features: [feature(46, { osm_key: "highway", name: "Main Street", housenumber: undefined })] }), { ok: true, suggestions: [] });
});

test("normalized queries coalesce, successful results cache briefly, and every upstream attempt shares one budget", async () => {
  const { createPhotonSearchService } = await loadSearch();
  let calls = 0;
  let now = 1000;
  const service = createPhotonSearchService({
    fetcher: async () => {
      calls += 1;
      await Promise.resolve();
      return new Response(JSON.stringify({ features: [feature(41)] }), { status: 200 });
    },
    now: () => now,
    budgetLimit: 3,
    budgetWindowMs: 60_000,
    cacheTtlMs: 500,
  });
  const [first, coalesced] = await Promise.all([service.search("Acme Foods"), service.search("  acme   foods ")]);
  assert.deepEqual(first, coalesced);
  assert.equal(first.kind, "results");
  assert.equal(calls, 2);
  assert.deepEqual(await service.search("ACME FOODS"), first);
  assert.equal(calls, 2);
  now += 501;
  assert.deepEqual(await service.search("another query"), { kind: "rate_limited", code: "budget_exhausted" });
  assert.equal(calls, 2);
});

test("true 200 empty differs from total unavailable, failures are not cached, and diagnostics omit PII", async () => {
  const { createPhotonSearchService } = await loadSearch();
  const empty = createPhotonSearchService({ fetcher: async () => new Response(JSON.stringify({ features: [] }), { status: 200 }) });
  assert.deepEqual(await empty.search("No Such Business"), { kind: "empty", suggestions: [] });

  let calls = 0;
  const logs: Array<Record<string, unknown>> = [];
  const unavailable = createPhotonSearchService({
    fetcher: async () => { calls += 1; return new Response("upstream detail", { status: 503 }); },
    log: entry => logs.push(entry),
  });
  assert.deepEqual(await unavailable.search("55 Private Home Street"), { kind: "unavailable", code: "provider_unavailable" });
  assert.deepEqual(await unavailable.search("55 Private Home Street"), { kind: "unavailable", code: "provider_unavailable" });
  assert.equal(calls, 4);
  const diagnostic = JSON.stringify(logs);
  assert.doesNotMatch(diagnostic, /Private|Home|Street|55/i);

  let malformedCalls = 0;
  const malformed = createPhotonSearchService({ fetcher: async () => { malformedCalls += 1; return Response.json({ features: [{ nope: true }] }); }, log: () => {} });
  assert.deepEqual(await malformed.search("Malformed provider result"), { kind: "unavailable", code: "provider_unavailable" });
  assert.deepEqual(await malformed.search("Malformed provider result"), { kind: "unavailable", code: "provider_unavailable" });
  assert.equal(malformedCalls, 4, "wholly malformed arrays must not be cached");
});

test("expired success entries are swept when a different query arrives", async () => {
  const { createPhotonSearchService } = await loadSearch();
  let now = 100;
  const service = createPhotonSearchService({
    fetcher: async () => Response.json({ features: [feature(now)] }),
    now: () => now,
    cacheTtlMs: 10,
  });
  await service.search("first place");
  assert.equal(service.cacheSize(), 1);
  now += 11;
  await service.search("second place");
  assert.equal(service.cacheSize(), 1);
});
