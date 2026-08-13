# Task 3 Brief — Primary Driver Workflow

## Objective

Complete the smallest real StopScore 2.0 driver loop on top of the reviewed Task 1 API and Task 2 setup shell:

`Navigate → Arrive → Depart → Stop Knowledge → Publish → next stop → Finish Day`

This task is incomplete until production-boundary tests prove failure retention, retry identity, server-authoritative advancement, request ownership, focus transfer, and final-day completion.

## Protected scope

- Preserve Task 1 domain/schema/auth/tenant/idempotency behavior.
- Preserve Task 2 setup recovery, route ordering, Photon-only real-place contract, session gate, and serialized start ownership.
- Never use fake/manual stops, a map, Nominatim autocomplete, or the word `review` in product UI.
- Do not add an active-day equipment edit unless a real authenticated server mutation is implemented. Prefer truthful unavailable copy.
- Do not deploy or create a production checkpoint.

## Required product behavior

### Work Mode

- Stable spatial layout with state-specific color and exactly one legal primary action.
- Legal state sequence: Navigate, Arrive, Depart, Experience/Stop Knowledge, Publish, then server-selected next stop or Finish.
- Display equipment in this exact order: `Truck #`, `Trailer Type`, `TRL #`, `Odometer`.
- For Drop & Hook, show exact detail labels: `TRL # dropped`, `TRL # picked up`, `Reference #`.
- Navigation boundary must say exactly: `StopScore is not a GPS`.
- External navigation uses the normalized stop address. Provide a reliable copy-address fallback.
- An unavailable active-day equipment edit must be visibly disabled and truthfully explained.

### Stop Knowledge experience

- Visible card labels in exact order:
  1. `Yard Experience`
  2. `Staging`
  3. `Staff Experience`
  4. `Waiting Time`
  5. `Bathroom Access`
- Persist domain keys in exact order: `yard`, `staging`, `staff`, `waitingTime`, `bathroomAccess`.
- Scores are whole numbers 1 through 5.
- Waiting categories and visible meaning:
  - `Quick` — 15–45 min
  - `Standard` — 30 min–1 hr
  - `Long` — 1–2 hr
  - `Extremely Delayed` — 2+ hr
- Bathroom starts with Yes/No. If Yes, require `Clean`, `Dirty`, or `Needs improvement`; if No, produce `No bathroom access`.
- Preserve the full draft on API, authentication, network, malformed, and `{ workday: null }` failures.
- Generate one idempotency key per experience draft and reuse it for every retry of that draft.

### Authority, completion, and ownership

- Publish may advance only after a successful authenticated response.
- The next stop comes strictly from the returned server `activeStopIndex`; never increment locally.
- The final successful publish transitions to Finish Day.
- Finish succeeds only with an authoritative completed aggregate; it clears the active pointer while retaining the completed summary.
- Every mutation must reject `{ workday: null }` before coordinator success or aggregate replacement. Restore alone may be nullable.
- Cross-operation request ownership/versioning must prevent a delayed old response from overwriting a newer aggregate.
- Retain a single visible error owner in production; avoid duplicate alerts.

### Accessibility and focus

- Deterministic focus when entering Work Mode, advancing to the next stop, entering Stop Knowledge, and entering Finish Day.
- Use a complementary live announcement for state/stop advancement, not a duplicate error alert.
- Long route progress must remain scrollable without clipping.
- Keyboard, labels, dialog/focus return, touch sizes, and reduced-motion behavior must remain WCAG 2.2 AA oriented.

## Test-first requirements

Capture RED before production changes, then implement the minimum correction. Tests must execute production boundaries rather than source-regex-only assertions:

- legal Work Mode action states and exact equipment/Drop & Hook copy;
- normalized navigation deep link plus copy fallback;
- exact five cards/order/domain keys and validation;
- publish failure keeps draft and active stop, retry reuses the same key;
- malformed/null mutation response preserves mounted aggregate and draft;
- publish success uses the exact returned `activeStopIndex`, including a non-local index;
- final publish and finish yield/retain the completed aggregate;
- delayed stale response cannot replace newer state;
- deterministic focus and one live announcement;
- active equipment edit is honest and non-operable;
- sign-in error/cancel/focus behavior remains real and does not weaken API auth.

## Expected files

- `app/v2/components/WorkMode.tsx`
- `app/v2/components/ExperienceFlow.tsx`
- `app/v2/components/FinishDay.tsx`
- focused workflow/request/focus modules under `app/v2/`
- `app/v2/StopScoreV2App.tsx`
- `app/v2/useWorkday.ts`
- `app/v2/styles.css`
- executable Task 3 tests and package gates
- `.superpowers/sdd/2026-08-11-stopscore-2-0-primary-workflow/task-3-report.md`

## Required final evidence

- Focused Task 3 tests pass.
- Full V2/full repository tests pass.
- `npm run typecheck:v2` passes.
- `npm run lint` passes.
- Verified `npm run build` and artifact validation pass.
- Runtime root/session/manifest smoke passes.
- Diff hygiene passes.
- Bounded commit with report; no push or deployment.
