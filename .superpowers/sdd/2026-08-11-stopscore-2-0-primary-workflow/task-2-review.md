# Task 2 Independent Review

## Verdict

- **Spec: FAIL**
- **Quality: FAIL**

The supplied focused gate is green (`node --test tests/v2-setup-ui.test.ts tests/v2-place-search.test.ts`: 12/12), and the patch does satisfy substantial portions of the contract: the root is v2-only, equipment/stop labels are exact, committed ordering is modeled separately, session data is fetched from the real endpoints, the PWA manifest is present, and Photon attempts are U.S.-scoped and budgeted. The failures below are runtime/integration gaps not exercised by that gate.

## Critical

### 1. A start retry after editing setup sends the stale first equipment/route payload

**Spec and Quality.** `useWorkday.start(payload)` creates `startGate` only once, and the gate's operation closes over the `payload` from that first invocation (`app/v2/useWorkday.ts:77-92`). A rejected operation clears only the gate's in-flight promise (`app/v2/setup/controllers.ts:92-100`); it does not replace the operation or captured payload. The Prepare screen leaves Back enabled after a failure, so the driver can return to Route List, change equipment/stops/order, and re-enter Prepare (`app/v2/components/RouteFlow.tsx:171-176`). “Try Starting Again” then sends the old equipment and stops while the UI displays the new committed setup.

This violates the requirement that Prepare start the currently committed `{equipment, stops}` and risks activating the wrong route. The same gate also permanently memoizes its first successful result for the hook lifetime, so it is not safe for a later new setup in the same mounted app. The current gate test uses a parameterless operation (`tests/v2-setup-ui.test.ts:115-139`) and cannot detect payload staleness.

## Important

### 2. Malformed Photon feature arrays are classified and cached as a true 200 empty result

**Spec and Quality.** `parsePhotonPayload` returns `ok: true` for any object whose `features` member is an array, even when every entry is malformed (`app/v2/server/place-search.ts:98-109`). `execute` therefore treats `{features:[{nope:true}]}` as a valid empty provider response (`:159-163`), and `search` caches it (`:177-179`). A direct runtime probe confirmed that two same-query searches made only the first request's two upstream attempts and both returned `kind: "empty"`.

This breaks the explicit distinction between true 200 empty and malformed/provider-unavailable responses, and violates the no-cache rule for malformed payloads. The test covers a malformed top-level object but not a malformed non-empty feature array (`tests/v2-place-search.test.ts:41-60`).

### 3. Photon admits street-only road features as “street addresses”

**Spec.** `streetLine` is considered sufficient whenever `street` alone is present; no house number or accepted business key is required (`app/v2/server/place-search.ts:80-87`). A runtime probe with `osm_key: "highway"`, `street: "Main Street"`, and no house number produced a selectable canonical suggestion for “Main Street, Buffalo, New York.” That is a road/locality result, not a business or street address under the locked search contract. The current parser test rejects only a locality-only feature (`tests/v2-place-search.test.ts:41-58`).

### 4. Recovery accepts cross-field-impossible equipment state

**Spec and Quality.** Draft equipment and validated equipment are validated independently, then compared only by equipment type (`app/v2/setup/recovery.ts:60-74`). A persisted `equipmentDraft` showing truck `VISIBLE-1` / odometer `100` with `validatedEquipment` truck `HIDDEN-2` / odometer `999` restores successfully at Route Search. The driver sees one set of values while Prepare sends the other (`app/v2/StopScoreV2App.tsx:107-110`). Tractor trailer fields have the same mismatch risk.

Such a state cannot be produced by the reducer because changing a field clears `validatedEquipment` (`app/v2/setup/model.ts:141-150`), so it is exactly the kind of malformed/cross-field-impossible draft that must fail closed.

### 5. Accessible modal focus requirements are incomplete

**Spec.** The sign-in modal focuses its link and handles Escape, but it has no Tab/Shift+Tab focus trap (`app/v2/StopScoreV2App.tsx:90-92,133-135`); keyboard focus can move into the background header/Home controls despite `aria-modal="true"`.

The delete dialog does trap its two controls, but fallback restoration fails when deleting the sole stop. Deletion changes the stage to Route Search (`app/v2/setup/model.ts:174-180`), unmounting `routeHeading`; the invoker is also removed, so both branches in `closeDeleteDialog` have no connected focus target (`app/v2/components/RouteFlow.tsx:59-64,179-182`). This violates invoker/fallback focus restoration.

### 6. Overlong equipment input throws instead of rendering and focusing the first validation error

**Spec and Quality.** `validateEquipmentDraft` checks presence but not the domain's 80-character limits, then calls throwing `validateEquipment` without a catch (`app/v2/setup/model.ts:89-111`; `app/v2/domain/workday.ts:93-97,104-131`). The form submit calls that function before dispatch and likewise does not catch (`app/v2/components/EquipmentFlow.tsx:33-38`). An 81-character Truck # produces an uncaught `ValidationError` rather than an inline error with deterministic focus. Inputs also have no `maxLength` guard.

### 7. `useWorkday` can become permanently non-writing under React Strict Effects replay

**Quality.** `mounted` starts true, but the effect only sets it false during cleanup and never restores it to true during setup (`app/v2/useWorkday.ts:32-35`). React development Strict Effects run setup → cleanup → setup while retaining the ref; after that replay, every session/workday settlement is discarded by the `mounted.current` guards (`:46-67`), leaving the app loading. The standard lifecycle effect must set the flag true in its setup path as well as false in cleanup. No hook/component execution test covers this lifecycle.

### 8. Required UI behavior coverage is mostly structural and misses the integration risks above

**Spec and Quality.** The final setup test reads component source and asserts regexes (`tests/v2-setup-ui.test.ts:185-215`). It does not execute session-gated Start My Day, sign-in cancellation/focus trapping, equipment DOM focus, delete-dialog restoration, RouteFlow-to-`useWorkday` start ownership, or reload/effect behavior. The pure reducer/controller tests are useful, but the contract explicitly says structural source checks may supplement executable behavior and never substitute for it. The stale start payload, malformed-cache path, missing modal trap/fallback, and lifecycle liveness defect all pass the reported gate as a result.

## Minor

### 9. A completed right swipe leaves the row translated by 96px

**Quality.** Pointer-up preserves `offsetX` and `markLocalReady` (`app/v2/setup/controllers.ts:30-40`), and RouteFlow stores that state while marking the stop ready (`app/v2/components/RouteFlow.tsx:103-107`). Unlike the intentional left-side Delete reveal, there is no right-side revealed action, so the row remains visibly displaced after the local-ready gesture. The swipe test checks persistence only for the left reveal (`tests/v2-setup-ui.test.ts:89-100`).

### 10. Expired Photon cache entries are never swept unless the exact key is queried again

**Quality.** The per-isolate cache deletes an expired entry only during a later lookup of the same normalized key (`app/v2/server/place-search.ts:171-173`). Unique queries therefore leave expired entries in the map for the isolate lifetime. The upstream budget limits growth rate but does not bound total retained entries.

## Verification performed

- Read the Task 2 brief, report, and exact `a357a3b..bbcc156` review diff.
- Inspected every changed production module and the added tests.
- `git diff --check a357a3b..bbcc156` completed without findings.
- Fresh focused gate: 12 tests passed, 0 failed.
- Direct runtime probes reproduced malformed Photon caching, street-only suggestion acceptance, cross-field-impossible draft restoration, and the overlong-equipment exception.

No code was edited and nothing was deployed or pushed.
