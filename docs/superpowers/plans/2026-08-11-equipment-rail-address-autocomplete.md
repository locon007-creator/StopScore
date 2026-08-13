# Equipment Rail and Address Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six persisted equipment categories in a horizontal Android selector and make route address suggestions appear automatically, close after selection, and retain the existing stop-type workflow.

**Architecture:** Extend the canonical equipment union and D1 constraint additively, then let the existing setup reducer and repository carry the new values without parallel state. Keep the equipment UI pending-selection model, but render it as a snap rail. Reuse the authenticated Photon boundary and search-ownership controller; React owns only debounce, highlighted suggestion, and screen transitions.

**Tech Stack:** React 19, TypeScript, Vinext, Phosphor Icons, Drizzle ORM, Cloudflare D1/Miniflare, Node test runner, react-test-renderer, CSS.

## Global Constraints

- Canonical order: Truck Tractor, Truck Bobtail, Straight Truck, Box Truck, Small Box Truck, Cargo Van.
- Only Truck Tractor accepts trailer type and trailer number.
- Preserve all existing workdays, setup drafts, stops, route ordering, and idempotency records.
- Use one horizontally swipeable rail on Android; never compress six cards into unreadable fixed columns.
- Selected card uses the complete brand-red selected surface and bottom confirmation.
- Autocomplete begins after three trimmed characters and 300ms idle time.
- Search remains authenticated, U.S.-scoped, bounded, privacy-safe, and newest-query authoritative.
- Choosing a suggestion clears suggestions and opens the existing Choose Stop Type step.
- No unsupported compliance, specification, search-filter, or route-optimization features.

---

### Task 1: Additive Six-Type Domain and D1 Contract

**Files:**
- Modify: `app/v2/domain/workday.ts`
- Modify: `app/v2/setup/model.ts`
- Modify: `app/v2/setup/recovery.ts`
- Modify: `db/schema.ts`
- Create: generated `drizzle/0008_*.sql` and matching `drizzle/meta/*`
- Test: `tests/v2-domain.test.ts`
- Test: `tests/v2-setup-ui.test.ts`
- Test: `tests/v2-schema.test.ts`
- Test: `tests/v2-real-d1.test.ts`

**Interfaces:**
- Produces: `EquipmentType = "tractor" | "bobtail" | "straight_truck" | "box_truck" | "small_box_truck" | "cargo_van"`.
- Produces: `EQUIPMENT_OPTIONS` in the exact approved display order.
- Preserves: `validateEquipment(value): Equipment`, setup recovery, and repository storage signatures.

- [ ] **Step 1: Write failing domain, recovery, and real-D1 tests**

Add literal assertions that both new types validate without trailer fields, that trailer fields remain tractor-only, that recovery accepts new drafts, and that a real migrated D1 database stores/restores both new values while retaining a pre-existing `straight_truck` row.

```ts
assert.deepEqual(validateEquipment({ type: "small_box_truck", truckNumber: "SB-8", odometer: "1200" }), {
  type: "small_box_truck", truckNumber: "SB-8", odometer: "1200",
});
assert.deepEqual(EQUIPMENT_OPTIONS.map(option => option.label), [
  "Truck Tractor", "Truck Bobtail", "Straight Truck", "Box Truck", "Small Box Truck", "Cargo Van",
]);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/v2-domain.test.ts tests/v2-setup-ui.test.ts tests/v2-schema.test.ts tests/v2-real-d1.test.ts`

Expected: failures name invalid `box_truck` / `small_box_truck`, the four-item equipment list, and the old D1 check constraint.

- [ ] **Step 3: Extend domain, setup, recovery, and schema minimally**

Use the approved order everywhere:

```ts
export const EQUIPMENT_TYPES = [
  "tractor", "bobtail", "straight_truck", "box_truck", "small_box_truck", "cargo_van",
] as const;
```

Add options with `/assets/equipment/box-truck.webp` and `/assets/equipment/small-box-truck.webp`. Extend recovery's allowlist and the schema check constraint without changing non-tractor trailer validation.

- [ ] **Step 4: Generate and inspect the additive migration**

Run: `npm run db:generate`

Inspect the generated SQL to confirm SQLite's table rebuild copies every old column and row, recreates indexes/constraints, and expands only `v2_workdays_equipment_check`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/v2-domain.test.ts tests/v2-setup-ui.test.ts tests/v2-schema.test.ts tests/v2-real-d1.test.ts`

Expected: all focused tests pass, including real D1 insertion/restoration.

- [ ] **Step 6: Commit**

```bash
git add app/v2/domain/workday.ts app/v2/setup/model.ts app/v2/setup/recovery.ts db/schema.ts drizzle tests/v2-domain.test.ts tests/v2-setup-ui.test.ts tests/v2-schema.test.ts tests/v2-real-d1.test.ts
git commit -m "feat: add six equipment categories"
```

### Task 2: Horizontal Equipment Rail and Confirmation

**Files:**
- Modify: `app/v2/components/EquipmentFlow.tsx`
- Modify: `app/v2/styles.css`
- Add asset only if needed: `public/assets/equipment/straight-truck.webp`
- Test: `tests/v2-visual-contract.test.tsx`
- Test: `tests/v2-final-review-fix.test.ts`

**Interfaces:**
- Consumes: six-item `EQUIPMENT_OPTIONS`.
- Preserves: pending `selectedType`, `select-equipment` dispatch on Continue, and focus restoration.
- Produces: `aria-pressed` full-card selection and fixed confirmation dock.

- [ ] **Step 1: Write failing mounted interaction and layout tests**

The mounted test selects Small Box Truck, confirms that only its full button has `aria-pressed="true"`, verifies no reducer transition before Continue, clicks Continue, returns, and observes restored selection/focus. The CSS test requires horizontal scrolling and snapping:

```ts
assert.equal(cards.length, 6);
assert.equal(cards[4].findByType("strong").children[0], "Small Box Truck");
assert.equal(declarations(grid)["overflow-x"], "auto");
assert.match(declarations(grid)["grid-auto-flow"], /column/);
assert.match(declarations(grid)["scroll-snap-type"], /x/);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --import tsx --test tests/v2-visual-contract.test.tsx && node --test tests/v2-final-review-fix.test.ts`

Expected: failures show the old vertical list and incomplete option count.

- [ ] **Step 3: Implement the snap rail and selected surface**

Keep the existing button structure and change layout CSS to a one-row auto-column rail with `overflow-x: auto`, `scroll-snap-type: x mandatory`, hidden visual scrollbar, and 44px+ targets. Apply brand red to the complete selected button while preserving AA text contrast and the checkmark.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --import tsx --test tests/v2-visual-contract.test.tsx && node --test tests/v2-final-review-fix.test.ts`

- [ ] **Step 5: Commit**

```bash
git add app/v2/components/EquipmentFlow.tsx app/v2/styles.css public/assets/equipment tests/v2-visual-contract.test.tsx tests/v2-final-review-fix.test.ts
git commit -m "feat: add swipeable equipment rail"
```

### Task 3: Debounced Address Autocomplete and Suggestion Dismissal

**Files:**
- Modify: `app/v2/setup/controllers.ts`
- Modify: `app/v2/components/RouteFlow.tsx`
- Modify: `app/v2/styles.css`
- Test: `tests/v2-setup-ui.test.ts`
- Test: `tests/v2-mounted-workflow.test.tsx`

**Interfaces:**
- Extends: `createSearchOwnership<T>()` with selection that clears visible items.
- Produces: 300ms query debounce, combobox/listbox semantics, highlighted suggestion index, keyboard selection.
- Preserves: `GET /api/place-search?q=...`, Photon response contract, and `set-stage: stop-type` transition.

- [ ] **Step 1: Write failing controller and mounted tests**

Controller test proves selection clears items:

```ts
owner.settle(ticket, { kind: "results", items: [place] });
owner.select(place);
assert.deepEqual(owner.snapshot(), {
  ticket: 1, loading: false, items: [], selection: place, error: null,
});
```

Mounted test types `100 Main`, waits 299ms for zero requests, advances through 300ms for one request, renders suggestions, uses ArrowDown + Enter, then asserts suggestions are gone and Choose Stop Type displays the selected address. A newer typed query must suppress an older delayed response.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/v2-setup-ui.test.ts && node --import tsx --test tests/v2-mounted-workflow.test.tsx`

Expected: selection leaves items visible and no automatic request occurs after typing.

- [ ] **Step 3: Implement ownership clearing and stable debounced search**

Change `select` to clear `items`, `loading`, and `error`. In `RouteFlow`, memoize `runSearch(searchQuery)` and schedule it only while the route-search stage is active and trimmed query length is at least three. Cleanup cancels the timer; search ownership rejects stale results.

Implement input semantics:

```tsx
<input role="combobox" aria-autocomplete="list" aria-expanded={search.items.length > 0}
  aria-controls="place-suggestions" aria-activedescendant={activeIndex >= 0 ? `place-${activeIndex}` : undefined} />
<ul id="place-suggestions" role="listbox">...</ul>
```

Selection calls one helper that clears visible suggestions, sets the chosen place and query, and dispatches the existing stop-type transition.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/v2-setup-ui.test.ts && node --import tsx --test tests/v2-mounted-workflow.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add app/v2/setup/controllers.ts app/v2/components/RouteFlow.tsx app/v2/styles.css tests/v2-setup-ui.test.ts tests/v2-mounted-workflow.test.tsx
git commit -m "feat: add address autocomplete"
```

### Task 4: Android Workflow, Regression, and Deployment Gate

**Files:**
- Modify: `design-qa.md`
- Modify: task report under `docs/superpowers/` only if required by repository convention

**Interfaces:**
- Consumes: Tasks 1–3 production behavior.
- Produces: evidence for release and a verified Sites version/deployment.

- [ ] **Step 1: Run complete automated gates**

Run sequentially:

```bash
npm test
npm run lint
npm run db:generate
git diff --check
```

Expected: typecheck, V2 tests, mounted tests, legacy tests, Vinext build, Sites artifact validation, lint, and migration drift checks all pass.

- [ ] **Step 2: Verify the real 430px Android workflow in the cloud browser**

Use the production component in an isolated preview state. Verify horizontal swipe access to all six cards; choose Small Box Truck; observe complete red card, bottom confirmation, and Continue; return from Equipment Info and verify focus. Type an address, observe live suggestions, select one, confirm the panel disappears and Choose Stop Type displays the same authoritative address.

- [ ] **Step 3: Compare the browser capture with the approved equipment reference**

Place the approved source and browser screenshot side by side, correct visible P1/P2 layout problems, record viewport/state/interaction evidence in `design-qa.md`, and end the file with `final result: passed` only after inspection.

- [ ] **Step 4: Request independent code review**

Require zero Critical or Important findings for schema safety, saved-state compatibility, stale search ownership, keyboard behavior, and Android accessibility. Correct findings through new RED/GREEN tests.

- [ ] **Step 5: Commit release evidence**

```bash
git add design-qa.md docs/superpowers
git commit -m "docs: verify equipment and route setup"
```

- [ ] **Step 6: Push, save a Sites version, deploy, and poll terminal status**

Push exact HEAD to the configured Sites repository. Save that exact commit SHA, deploy the saved private version, poll until `succeeded` or `failed`, and verify the returned production URL.

