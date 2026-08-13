# Task 2 Report — PWA Shell, Setup, Route Preparation, Photon, and Recovery

## Outcome

Replaced the retired root prototype with the StopScore 2.0 application shell and the complete authenticated setup workflow through the honest active-workday handoff. Task 1 API/domain code and legacy database/storage data were not changed. Work Mode, Experience, and Finish UI were intentionally left for Task 3.

## TDD Evidence

Initial RED, before Task 2 production modules existed:

```text
$ node --test tests/v2-setup-ui.test.ts tests/v2-place-search.test.ts
tests 12; pass 0; fail 12; exit 1
Expected failures: missing app/v2 setup, recovery, interaction, Photon, component, app, and manifest modules.
```

Additional focused RED cycles found during integration/self-review:

```text
$ node --test --test-name-pattern='swipe ownership' tests/v2-setup-ui.test.ts
tests 1; pass 0; fail 1; exit 1
Expected: completed left swipe keeps Delete revealed; actual false.

$ node --test --test-name-pattern='versioned setup recovery' tests/v2-setup-ui.test.ts
tests 1; pass 0; fail 1; exit 1
Expected: restoreSetupState; actual function absent.

$ node --test --test-name-pattern='route stages reject' tests/v2-setup-ui.test.ts
tests 1; pass 0; fail 1; exit 1
Expected duplicate rejection stage route-list; actual stop-type.

$ node --test --test-name-pattern='runtime parsing emits' tests/v2-place-search.test.ts
tests 1; pass 0; fail 1; exit 1
Expected locality-only Photon feature rejection; actual city suggestion emitted.
```

Final focused GREEN:

```text
$ node --test tests/v2-setup-ui.test.ts tests/v2-place-search.test.ts
tests 12; pass 12; fail 0; exit 0
```

## Delivered Contract

- Root `app/page.tsx` now renders only `StopScoreV2App`; the legacy prototype remains recoverable from Git history.
- Responsive, safe-area-aware dark-default shell with an honest session identity and persisted global Light/Dark control. Existing pure-white light surface tokens remain authoritative.
- `/api/session` gates Start My Day. Unauthenticated users receive an accessible sign-in dialog targeting `/signin-with-chatgpt?return_to=%2F`; cancel restores focus and setup drafts remain untouched.
- Exact four-equipment selector and tractor/bobtail field rules, deterministic auto-advance/focus, first-invalid focus, value preservation, and hidden trailer cleanup.
- Explicit Search → Stop Type → Route List → Organize → Prepare route stages with canonical provider duplicate prevention, committed-order semantics, dedicated reorder controls, accessible deletion, keyboard alternatives, and pointer-safe swipe behavior.
- Start is owned above `RouteFlow`, coalesces repeated calls into one request, retains its idempotency key across retry, and enters the handoff only for an active Task 1 aggregate.
- Photon adapter provides bounded U.S. direct/structured/qualified attempts, shared per-isolate budget, normalized-query coalescing, short success cache, runtime feature validation, canonical OSM IDs, locality-only filtering, typed empty/unavailable/rate-limited results, current-query ownership, and PII-free diagnostics.
- Version 2 setup recovery is SSR/storage-exception safe, expires after 24 hours, fails closed on malformed/stale/impossible drafts, persists only committed route order, and implements server/completed-dismissal precedence.
- PWA manifest is exposed at `/manifest.webmanifest` with `StopScore Driver OS` metadata.

## Verification Evidence

```text
$ npm test
typecheck:v2: exit 0
verified vinext build: exit 0
artifact validation: ESM Worker default.fetch and hosting manifest present
tests 35; pass 35; fail 0; exit 0

$ npm run lint
exit 0; no lint findings
```

Runtime/build evidence:

- `CI=1 npm run dev -- --host 127.0.0.1 --port 5174` reached Vite ready state.
- `GET /` returned 200 and 19,604 bytes of rendered HTML containing the correct title, manifest link, development preview metadata, v2 root reference, and both stylesheet resources.
- `GET /manifest.webmanifest` returned the 376-byte manifest with the correct name, standalone display, `/` start URL, and dark theme/background metadata.
- Verified build listed `/`, `/api/session`, `/api/place-search`, and all existing Task 1 API routes; artifact validation passed.

## Self-Review

- Protected scope: no Task 1 domain, service, repository, D1 schema, or migration file changed. Existing legacy storage keys are neither rewritten nor deleted.
- No fake maps, weather, traffic, manual stops, seeded stops, enabled no-op controls, or Task 3 workflow implementation was added.
- Provider logs contain attempt index/reason/status only; search query and address are not logged. Total failures and malformed payloads are not cached.
- Route setup persistence excludes `organizingStops`; Back discards temporary order and Save Order commits contiguous zero-based order.
- Start draft clearing occurs only after an active response or an authoritative server aggregate; failure keeps the draft and permits a single controlled retry.
- `git diff --check` was reviewed; generated build output is ignored and not included in the commit.

## Concern / Verification Limitation

Automated browser screenshots could not run because the environment-provided Playwright package has no installed Chromium executable. Runtime HTML/manifest requests, structural accessibility assertions, pure interaction tests, full typecheck/lint, and the verified production build all passed. Live Photon network behavior was exercised through injected Response-level adapter tests rather than the external provider from this restricted environment.

## Fix Round 1 — Independent Review Corrections

### Root causes and corrections

- Replaced the hook-lifetime parameterless start gate with a production HTTP start client keyed by a canonical setup payload signature. Identical concurrent submissions share one promise/key; changed or rejected submissions get a new request/key; only the latest ticket may apply or return an active response.
- Added a request lifecycle controller used by `useWorkday` so Strict Effects setup → cleanup → setup restores mounted ownership and invalidates earlier settlements.
- Made Photon feature parsing tri-state: structurally malformed, well-formed but filtered, or selectable. Non-empty wholly malformed arrays are unavailable and uncached; mixed arrays keep only safe valid results; roads without a house number or accepted business identity are filtered. Expired success entries are swept on later searches.
- Recovery now requires normalized equality between the visible equipment draft and validated equipment for truck number, odometer, trailer type, and trailer number, and rejects overlong persisted fields.
- Equipment validation now bounds all free-text equipment fields at 80 normalized characters, returns inline/focusable errors instead of throwing, and exposes matching `maxLength` guards.
- Both sign-in and delete dialogs use the same executable Tab/Shift+Tab/Escape focus controller. Delete restoration falls back to the stable, still-mounted RouteFlow root when the sole stop and invoker disappear.
- A completed right swipe now records only the honest local-ready marker and resets visual translation; left-swipe Delete reveal remains open.

### RED evidence

```text
$ node --test tests/v2-workday-client.test.ts tests/v2-place-search.test.ts tests/v2-setup-ui.test.ts
tests 18; pass 8; fail 10; exit 1

Expected failing boundaries:
- workday-client module absent: edited payload/new key, rejection retry, Strict Effects lifecycle (3)
- wholly malformed Photon array accepted/cached and cache sweep absent (3)
- right swipe retained +80px transform and modal focus helpers absent (2)
- mismatched recovered equipment accepted (1)
- overlong equipment threw ValidationError (1)

$ node --test --test-name-pattern='returning to an earlier setup' tests/v2-workday-client.test.ts
tests 1; pass 0; fail 1; exit 1
Expected: an A → B → A edit sequence creates a third current request/key; actual: the stale first A flight was reused.
```

### Focused GREEN evidence

```text
$ node --test tests/v2-workday-client.test.ts
tests 4; pass 4; fail 0; exit 0

$ node --test tests/v2-place-search.test.ts
tests 5; pass 5; fail 0; exit 0

$ node --test tests/v2-setup-ui.test.ts
tests 10; pass 10; fail 0; exit 0

$ node --test tests/v2-workday-client.test.ts tests/v2-place-search.test.ts tests/v2-setup-ui.test.ts
tests 19; pass 19; fail 0; exit 0
```

The delayed/edit/retry test executes the production request serializer and ownership client with real `RequestInit`, `Headers`, JSON bodies, idempotency keys, delayed `Response` objects, and current-workday settlement. Modal, lifecycle, recovery, swipe, validation, and Photon tests execute production controllers/parsers used by the React components; source assertions remain supplemental.

### Final verification

```text
$ npm run typecheck:v2
exit 0

$ npm run lint
exit 0; no findings

$ npm test
scoped typecheck: exit 0
verified vinext build and artifact validation: exit 0
tests 42; pass 42; fail 0; exit 0

$ npm run build
exit 0
Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present.
```

Runtime smoke:

```text
$ CI=1 npm run dev -- --host 127.0.0.1 --port 5176
Vite ready on loopback.
GET /: 200 (19,604-byte rendered HTML)
GET /api/session: 200, {"user":null}
GET /api/place-search?q=ab: 200, typed empty result
GET /manifest.webmanifest: 200 (376 bytes)
```

No Task 1 domain/service/repository/schema files, legacy storage data, Work Mode, Experience, or Finish UI were changed. No push or deployment was performed. The existing Chromium screenshot limitation remains unchanged.

## Fix Round 2 — Serialized Start Authority and Retry Replay

### Root cause and minimum correction

The Round 1 client enforced single-flight per payload signature, not across the start boundary. Different setup signatures therefore created concurrent POSTs, and each new POST allocated a new idempotency key. Client-side response tickets could hide a stale response but could not undo whichever setup the server committed first.

`createWorkdayStartClient` now owns one global active POST and one serialized newest-intent slot. Identical active or queued payloads coalesce. A changed payload waits until the active request settles. If the active request succeeds, that server aggregate is authoritative, is applied once, resolves the queued caller, and suppresses a second start. If it fails, only the newest queued payload launches. Each logical payload signature retains one key through HTTP, network, and lost-response failures; the key is released only after an authoritative response, so an ambiguous committed request can replay safely without preventing a later workday.

### RED evidence

```text
$ node --test tests/v2-workday-client.test.ts
tests 5; pass 2; fail 3; exit 1

Expected failures at the production client/server boundary:
- authoritative A with edited B waiting: 2 POSTs were in flight instead of 1
- failed transport A with edited B waiting: B launched concurrently instead of after A settled
- lost response after server commit: retry used a new key and received an active-workday conflict

Existing identical-payload coalescing and Strict Effects lifecycle tests remained green.
```

### GREEN and integration evidence

```text
$ node --test tests/v2-workday-client.test.ts
tests 5; pass 5; fail 0; exit 0

$ node --test tests/v2-workday-client.test.ts tests/v2-place-search.test.ts tests/v2-setup-ui.test.ts
tests 20; pass 20; fail 0; exit 0
```

The start tests execute the production client serializer against the real Task 1 HTTP handler, service, and in-memory repository. They prove that an authoritative A suppresses queued B and is surfaced to both callers; a pre-server A transport failure serializes into B with server and UI both owning B; a lost A response retries the same key and returns the repository’s committed aggregate; and identical payloads share one promise and POST.

### Final verification and runtime

```text
$ npm run typecheck:v2
exit 0

$ npm run lint
exit 0; no findings

$ npm test
scoped typecheck: exit 0
verified vinext build and artifact validation: exit 0
tests 43; pass 43; fail 0; exit 0

$ npm run build
exit 0
Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present.
```

Same-process runtime smoke on port 5177 reached Vite ready state: `/` returned 200 with 19,595 bytes, `/api/session` returned 200 with `{"user":null}`, and `/manifest.webmanifest` returned 200 with 376 bytes.

Self-review confirmed that only the Task 2 client coordinator, its executable production-boundary tests, and this report changed. Task 1 authentication, uniqueness, service, repository, schema, and migration code were not weakened or edited. No fake aggregate or second-workday fallback was introduced. Reviewer files remain preserved and excluded. No push or deployment was performed.

## Fix Round 3 — Ambiguous Lost-Response Reconciliation

### Root cause and bounded correction

Round 2 serialized POSTs, but its rejection handler advanced immediately from active A to queued B for every error. A returned non-success HTTP response and a thrown transport error are not equivalent: the former is a settled rejection from the server boundary, while the latter is ambiguous because A may already have committed and only its response was lost.

The coordinator now treats a non-success HTTP response as definitive and preserves the ordinary A-rejected → newest-B path. A transport rejection marks A uncertain and, when B is queued, reconciles A first by replaying the same payload with the retained idempotency key. An authoritative replay applies once, resolves both callers to A, clears uncertainty, and suppresses B. If reconciliation remains transport-ambiguous, B is not launched and A’s recovery identity is retained for the next explicit attempt. Only a definitive A rejection releases the queue.

### RED evidence

```text
$ node --test tests/v2-workday-client.test.ts
tests 6; pass 5; fail 1; exit 1

Failure: committed A with a lost response and queued edited B rejected A and advanced toward B instead of replaying key A.
The definitive pre-service rejection → B, same-payload coalescing, no-queue lost-response replay, authoritative-success suppression, and lifecycle cases remained green.
```

### GREEN and production-boundary evidence

```text
$ node --test tests/v2-workday-client.test.ts
tests 6; pass 6; fail 0; exit 0

$ node --test tests/v2-workday-client.test.ts tests/v2-place-search.test.ts tests/v2-setup-ui.test.ts
tests 21; pass 21; fail 0; exit 0
```

The new regression executes the production client through the real Task 1 HTTP handler, service, and in-memory repository. A commits with `start-key-1`, its response is lost, edited B is queued, and reconciliation POSTs A again with `start-key-1`. Both callers receive the same active A aggregate, the repository exposes that one authority, `onCurrentWorkday` runs once, and no key for B is allocated or sent.

### Final verification and runtime

```text
$ npm run typecheck:v2
exit 0

$ npm run lint
exit 0; no findings

$ npm test
scoped typecheck: exit 0
verified vinext build and artifact validation: exit 0
tests 44; pass 44; fail 0; exit 0

$ npm run build
exit 0
Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present.
```

Same-process runtime smoke on port 5178 reached Vite ready state: `/` returned 200 with 19,587 bytes, `/api/session` returned 200 with `{"user":null}`, and `/manifest.webmanifest` returned 200 with 376 bytes.

Self-review confirmed the correction is limited to the Task 2 start coordinator, its real production-boundary regression, and this report. Task 1 authentication, uniqueness, HTTP handler, service, repository, schema, and migration code were not edited or weakened. Reviewer files remain preserved and excluded. No push or deployment was performed.
