# StopScore Equipment and Trailer Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Jose’s approved vehicle → trailer → equipment-information setup flow without changing unrelated StopScore behavior.

**Architecture:** Keep `EquipmentFlow` responsible for pending presentation state and keep `setupReducer` authoritative for committed setup state. Extend the existing trailer value union additively, carry the selected trailer type through the existing equipment-selection action, and migrate the D1 check constraint without rewriting existing rows.

**Tech Stack:** React 19, TypeScript, Vinext/Vite, Drizzle/D1, Node test runner, PostCSS.

## Global Constraints

- Preserve existing saved drafts, workdays, route workflow, authentication, theme behavior, and all screens outside Equipment setup.
- Use the five existing real vehicle assets; do not add trailer images.
- Vehicle order is Truck Tractor, Truck Bobtail, Small Box Truck, Box Truck, Cargo Van.
- Trailer order is Dry Van, Reefer, Flatbed, Step Deck, Tanker, Other.
- Use test-first development and verify the complete production build before claiming readiness.
- Deployment is excluded and requires Jose’s separate approval.

---

### Task 1: Lock the approved interaction

**Files:**
- Modify: `tests/v2-visual-contract.test.tsx`
- Modify: `tests/v2-setup-ui.test.ts`

**Interfaces:**
- Consumes: `EquipmentFlow`, `setupReducer`, `initialSetupState`.
- Produces: regression coverage for trailer reveal, selection gating, selected-value transfer, back restoration, non-tractor hiding, and approved vehicle order.

- [ ] Add a mounted test that selects Truck Tractor, verifies the six text-only trailer buttons, verifies Continue is disabled before trailer selection, selects Tanker, continues, and observes Tanker on Equipment Information.
- [ ] Extend the same test to go Back and verify both Truck Tractor and Tanker remain selected.
- [ ] Add a reducer test proving a non-tractor selection clears hidden trailer values.
- [ ] Run the focused tests and confirm they fail because inline trailer selection and the new trailer values are missing.

### Task 2: Implement state, persistence, and UI

**Files:**
- Modify: `app/v2/domain/workday.ts`
- Modify: `app/v2/setup/model.ts`
- Modify: `app/v2/setup/recovery.ts`
- Modify: `app/v2/components/EquipmentFlow.tsx`
- Modify: `app/v2/components/WorkMode.tsx`
- Modify: `app/v2/styles.css`
- Modify: `db/schema.ts`
- Create: generated additive migration under `drizzle/`

**Interfaces:**
- Consumes: `EquipmentType`, `TrailerType`, `SetupAction`, `EquipmentDraft`, `TRAILER_OPTIONS`.
- Produces: `select-equipment` with an optional trailer type, six canonical trailer values, inline trailer buttons, large equipment-information controls, and a database constraint accepting the additive values.

- [ ] Add `tanker` and `other` to the canonical trailer union, UI metadata, recovery allowlist, Work Mode labels, and D1 check constraint.
- [ ] Extend `select-equipment` to accept the pending trailer type and preserve it only for Truck Tractor.
- [ ] Add local pending trailer state to `EquipmentFlow`; reveal text-only `aria-pressed` buttons for Truck Tractor and gate Continue until a trailer is selected.
- [ ] Replace the Equipment Information trailer dropdown with a read-only selected trailer summary and keep Trailer Number optional.
- [ ] Add equipment-specific form classes for larger labels and controls without changing other forms.
- [ ] Generate and inspect the additive D1 migration.
- [ ] Run the focused tests until they pass.

### Task 3: Verify protected behavior

**Files:**
- Modify only when a verified in-scope defect requires correction: files from Task 2.
- Update: `design-qa.md`

**Interfaces:**
- Consumes: the complete application and generated artifact.
- Produces: fresh test, build, schema, and visual evidence.

- [ ] Run `npm run test:v2` and confirm all focused and workflow tests pass.
- [ ] Run `npm test`, `npm run lint`, `npm run db:generate`, and `git diff --check`.
- [ ] Start the Sites agent preview and exercise Truck Tractor → Tanker → Equipment Information → Back at an Android-sized viewport in dark and light themes.
- [ ] Verify a non-tractor path does not show or persist trailer data.
- [ ] Record the observed results and any known limitation in `design-qa.md`.
- [ ] Stop before deployment and present the verified build to Jose for the separate deployment decision.

