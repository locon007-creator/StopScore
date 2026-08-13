# Task 3 Report — Work Mode, Stop Knowledge, and Finish Day

## Outcome

Completed the authenticated StopScore 2.0 driver loop on top of the reviewed Task 1 API and Task 2 setup shell:

`Navigate → Arrive → Depart → Stop Knowledge → Publish → next server-selected stop → Finish Day`

The active route now uses the real server aggregate throughout. No fake stops, map UI, active-day equipment mutation, weakened authentication, checkpoint, push, or deployment was added.

## Built

- Stable state-colored Work Mode with one legal primary action, route progress, exact equipment display order, honest disabled equipment editing, normalized external navigation, copy-address fallback, and the exact `StopScore is not a GPS` boundary.
- Exact Drop & Hook detail labels with truthful unavailable values because the approved setup/API does not persist those three operational notes.
- Five-card Stop Knowledge flow in locked visible/domain order with whole-number 1–5 ratings, exact waiting categories/meanings, conditional bathroom access/condition, retry-safe publishing, and one visible error owner.
- Finish Day confirmation and a retained completed-route summary.
- Shared mutation client for stop events, experience publishing, and finish. It rejects null/malformed aggregates before replacement, accepts the returned `activeStopIndex` verbatim, and ignores delayed stale responses.
- One idempotency key per mounted experience draft, reused on every retry. A reducer used by the production form preserves the exact draft object across publish failure.
- Deterministic Work Mode, Stop Knowledge, next-stop, ready-to-finish, and completed-summary focus targets plus one complementary polite announcement.
- Dedicated `npm run test:v2` gate, retained inside the full repository `npm test` gate.

## TDD RED Evidence

Before the workflow production modules existed:

```text
$ node --test tests/v2-primary-workflow.test.ts
tests 8; pass 0; fail 8
Expected: missing app/v2/workflow/model.ts and associated production modules.

$ node --test tests/v2-workflow-ui.test.ts
tests 2; pass 0; fail 2
Expected: missing WorkMode, ExperienceFlow, and FinishDay components.
```

Additional scoped RED cycles:

- ready-to-finish focus resolved to the generic Work Mode target instead of Finish Day;
- dedicated `test:v2` package gate was absent;
- a well-shaped response with impossible `activeStopIndex: 99` was accepted;
- production draft state did not expose failure-retention behavior;
- plain `Sign in ...` API errors did not expose the real sign-in recovery link;
- an authoritative mutation did not invalidate an older restore ticket.

Each failure was reproduced before the minimum production correction.

## Executable Boundary Coverage

- Legal action mapping and exact equipment/Drop & Hook/navigation contracts.
- Exact experience labels/order/domain keys, score validation, waiting meanings, bathroom Yes/No/condition mapping.
- Failed publish retains draft state and retries with the same key.
- Null, malformed, and impossible-index responses never replace mounted authority.
- A non-local but valid returned index (`7` across eight stops) is accepted exactly; no local increment occurs.
- A delayed old mutation is rejected and cannot overwrite the newer aggregate.
- Real client → Task 1 HTTP handler → service → in-memory repository journey executes start, Navigate, Arrive, Depart, Publish, and Finish and retains the completed aggregate.
- Focus/announcement resolution covers Work Mode, Stop Knowledge, next stop, ready-to-finish, and completed summary.
- Structural UI checks remain supplemental to executable production-boundary tests.

## Verification

```text
$ node --test tests/v2-primary-workflow.test.ts tests/v2-workflow-ui.test.ts
tests 11; pass 11; fail 0

$ npm run test:v2
tests 53; pass 53; fail 0

$ npm test
V2 tests 53/53 pass
verified Vinext build/artifact pass
legacy tests 2/2 pass
combined tests 55/55 pass

$ npm run typecheck:v2
exit 0

$ npm run lint
exit 0

$ npm run build
exit 0; ESM Worker default.fetch and hosting manifest validated

$ git diff --check
exit 0
```

Runtime loopback smoke:

- `GET /` → 200, rendered HTML.
- `GET /api/session` → 200, real unauthenticated `{"user":null}` response.
- `GET /manifest.webmanifest` → 200, `application/manifest+json`.

## Self-Review

- Task 1 domain/service/repository/schema/migration files are unchanged.
- Task 2 setup, Photon, route ordering, recovery, and serialized start behavior are unchanged.
- All mutation endpoints remain the authenticated Task 1 endpoints and send an `Idempotency-Key`.
- One shared mutation ticket prevents cross-operation late writes. Applying start/mutation authority also invalidates an older restore ticket before setting client state.
- Active-day equipment edit is disabled and explicitly explained; no fake server mutation is implied.
- Errors preserve current UI data and provide the real sign-in route for both `sign in` and `sign-in` server wording.
- No product UI labels StopScore as a review product.

## Remaining Verification Scope

Task 4 still owns independent review and Sites agent-preview QA at Samsung-class and large viewports with real Photon results. No deployment or production checkpoint was attempted.

## Fix Round 1 — Independent Review Corrections

### Critical/Important corrections

- Added versioned, validated, 24-hour Stop Knowledge recovery scoped to exact workday/stop. It saves the complete five-card draft and its draft idempotency key before authentication navigation, restores both after remount, and clears only after an authoritative publish success.
- Added logical-operation key ownership and same-flight coalescing for Navigate, Arrive, Depart, and Finish. Ambiguous commit-plus-lost-response retries reuse the same key and retrieve the server’s stored aggregate. Publish continues to use its recovered draft key.
- Strengthened the single authoritative aggregate validator and reused it for start, restore, events, publish, and finish. It now enforces contiguous unique stops plus setup/active/completed state, index, and stop-progression invariants before any client replacement.
- Replaced the undocumented bathroom score mapping. The driver explicitly selects the 1–5 bathroom access score after the required Yes/No answer; Yes additionally requires Clean/Dirty/Needs improvement. The HTTP/domain operation now preserves `bathroom.available` and `bathroom.condition` separately from the explicit score.
- Added an additive `0007` migration with `bathroom_available` and `bathroom_condition`, including cross-field integrity, and persisted both through the D1 repository. Existing v2 data remains compatible (`false`/`null` defaults).
- Extracted mounted `WorkflowStatus` focus/live-region production behavior. Added executable mounted component coverage for the full legal Work Mode action sequence, external navigation/copy, card progression/validation, sign-in recovery/remount, retry identity, focus/live announcements, Finish, and retained completed summary.
- Corrected the locked sentence to `StopScore is not a GPS.` and replaced the remaining product UI verb `Review` with `Confirm`.

### RED evidence

```text
$ node --test tests/v2-task3-fix.test.ts
tests 4; pass 0; fail 4
Expected initial failure: missing versioned experience-recovery production module.

Direct authenticated handler/repository probes before correction:
- committed Navigate + lost response retried with event-1/event-2 and conflicted;
- committed Finish + lost response retried with finish-1/finish-2 and conflicted;
- completed/pending, completed/index-0, active/skipped-index, and setup/active-stop aggregates were accepted.

$ node --import tsx --test tests/v2-mounted-workflow.test.tsx
failed before WorkflowStatus existed.

Additional scoped RED:
- completed zero-stop aggregate was accepted;
- start client applied an impossible active aggregate;
- singular completion announcement rendered “1 stops”.
```

### GREEN evidence

```text
$ npm run test:v2
headless V2 tests 57/57 pass
mounted production tests 4/4 pass
combined V2 tests 61/61 pass

$ npm test
V2 tests 61/61 pass
legacy tests 2/2 pass
combined tests 63/63 pass
verified Vinext build/artifact pass

$ npm run typecheck:v2
exit 0

$ npm run lint
exit 0; no findings

$ npm run db:generate
No schema changes, nothing to migrate

$ git diff --check
exit 0
```

The direct lost-response regression executes production client → authenticated HTTP handler → service → memory repository for Navigate, Arrive, Depart, Publish, and Finish. Every operation commits once, loses the first response, retries the same key, and receives the replay aggregate without a stale conflict. Real-D1 tests additionally verify one experience row and the separately persisted bathroom score/availability/condition.

Runtime loopback smoke after the corrections:

- `GET /` → 200, 19,776-byte rendered HTML.
- `GET /api/session` → 200, real `{"user":null}` response.
- `GET /manifest.webmanifest` → 200, `application/manifest+json`.

The mounted test dependency emits React’s upstream `react-test-renderer` deprecation notice but no test failure, application warning, or production bundle dependency. No push, deployment, or checkpoint was attempted.

## Fix Round 2 — Bathroom Answer Invariant

### Correction

- A complete Stop Knowledge draft cannot validate or publish until the driver explicitly answers Yes or No for bathroom availability.
- Yes requires a persisted Clean, Dirty, or Needs improvement condition. No requires a null condition.
- Versioned recovery remains valid for a normal untouched bathroom card, but fails closed and removes any record with a bathroom score and no answer, Yes without a condition, or No with a condition.
- The mounted production boundary proves that malformed recovered state is discarded and does not call the publish write callback.
- Summary regressions prove the text comes from the explicit answer/condition: No bathroom access, Clean, or Dirty, independently of the numeric score.

### RED evidence

```text
$ node --test tests/v2-task3-fix.test.ts
tests 7; pass 5; fail 2
- full five-score draft with bathroomAnswer null validated as true and summarized as Needs improvement
- versioned recovery accepted that malformed draft

$ node --import tsx --test tests/v2-mounted-workflow.test.tsx
tests 5; pass 4; fail 1
- malformed recovered draft invoked the publish callback once
```

### GREEN evidence

```text
$ node --test tests/v2-task3-fix.test.ts
tests 7; pass 7; fail 0

$ node --import tsx --test tests/v2-mounted-workflow.test.tsx
tests 5; pass 5; fail 0

$ npm run test:v2
headless V2 tests 60/60 pass
mounted production tests 5/5 pass
combined V2 tests 65/65 pass

$ npm test
V2 tests 65/65 pass
legacy tests 2/2 pass
combined tests 67/67 pass
verified Vinext build/artifact pass

$ npm run typecheck:v2
exit 0

$ npm run lint
exit 0; no findings

$ npm run build
exit 0; ESM Worker default.fetch and hosting manifest validated

$ git diff --check
exit 0
```

Runtime loopback smoke:

- `GET /` → 200, 12,850-byte rendered HTML.
- `GET /api/session` → 200, real `{"user":null}` response.
- `GET /manifest.webmanifest` → 200, 376-byte `application/manifest+json` response.

The only emitted warnings remain the environment npm proxy notice, the Vinext proxy notice, and React’s upstream test-renderer deprecation notice. No push, deployment, or checkpoint was attempted.
