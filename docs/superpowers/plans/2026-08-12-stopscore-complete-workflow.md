# StopScore Complete Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved StopScore screen-by-screen driver workflow as a real, persistent, mobile-first application without regressing the existing server-authoritative workday engine.

**Architecture:** Keep the existing Next/Vinext single-route application, domain/service/repository boundaries, D1 persistence, and current setup reducer. Add focused view components and small state-machine extensions instead of rebuilding the application. UI-only transitional states remain client-local; workday mutations continue through the existing authoritative endpoints.

**Tech Stack:** React 19, TypeScript 5.9, Next 16/Vinext, Phosphor icons, CSS semantic tokens, Drizzle/D1, Node test runner, react-test-renderer.

## Global Constraints

- The approved design source is `docs/superpowers/specs/2026-08-12-stopscore-complete-workflow-approved.md`.
- Never use the word “review” in user-facing StopScore copy.
- Preserve authentication, D1 data, OSM canonical search, idempotency, ownership, and existing uncommitted user work.
- Light mode app and primary surfaces are `#FFFFFF`; dark mode remains visually unchanged.
- One primary action per state; 44px minimum controls; keyboard and reduced-motion support.
- Deployment is outside this plan.

---

### Task 1: Lock the approved state model and regression contract

**Files:**
- Modify: `app/v2/setup/model.ts`
- Modify: `app/v2/setup/recovery.ts`
- Test: `tests/v2-setup-ui.test.ts`
- Test: `tests/v2-visual-contract.test.tsx`

**Interfaces:**
- Produces: `SetupStage` including `trailer-choice`; reducer actions for equipment and trailer confirmation.
- Preserves: `SetupState`, `validateEquipmentDraft`, and persisted setup recovery.

- [ ] Add failing tests that tractor selection opens `trailer-choice`, Bobtail skips it, and recovery fails closed for transient screens.
- [ ] Run `npm run test:v2` and confirm the new assertions fail.
- [ ] Implement the minimal reducer and recovery changes.
- [ ] Rerun the affected tests and confirm they pass.

### Task 2: Build equipment selection, trailer selection, and equipment information

**Files:**
- Modify: `app/v2/components/EquipmentFlow.tsx`
- Modify: `app/v2/styles.css`
- Test: `tests/v2-visual-contract.test.tsx`

**Interfaces:**
- Consumes: `SetupStage`, `EQUIPMENT_OPTIONS`, `TRAILER_OPTIONS`.
- Produces: separate accessible screens that dispatch the existing setup actions.

- [ ] Replace the inline trailer picker contract with tests for a dedicated trailer screen and large equipment fields.
- [ ] Implement the separate screen, back behavior, tractor-only trailer data, and Bobtail bypass.
- [ ] Verify keyboard focus, labels, optional TRL #, and no hidden trailer state.

### Task 3: Complete Settings, Saved Stops and Routes, and active-day Home

**Files:**
- Modify: `app/theme.tsx`
- Modify: `app/v2/components/AppShell.tsx`
- Modify: `app/v2/components/Home.tsx`
- Create: `app/v2/components/SettingsPanel.tsx`
- Create: `app/v2/components/SavedItemsPanel.tsx`
- Modify: `app/v2/StopScoreV2App.tsx`
- Test: `tests/v2-theme-runtime.test.tsx`
- Test: `tests/v2-mounted-workflow.test.tsx`

**Interfaces:**
- Produces: root-owned `supportView` state and accessible full-screen panels.
- Consumes: existing `/api/saved-stops` and `/api/saved-routes` read endpoints.

- [ ] Add tests for immediate persisted Light/Dark selection, pure-white semantic surfaces, panel close/focus restoration, saved empty/error/content states, and active-day continuation.
- [ ] Implement the two support panels and wire header controls without changing workday authority.
- [ ] Rerun theme and mounted tests.

### Task 4: Match route construction and preparation to the approved flow

**Files:**
- Modify: `app/v2/components/RouteFlow.tsx`
- Modify: `app/v2/styles.css`
- Test: `tests/v2-mounted-workflow.test.tsx`
- Test: `tests/v2-visual-contract.test.tsx`

**Interfaces:**
- Consumes: existing search ownership, swipe reducer, and setup reducer.
- Produces: Search → Stop Type → Route List → Organize → Prepare with no embedded map.

- [ ] Add assertions for the approved headings, stop card information order, separate organize behavior, Prepare equipment summary, and disabled empty-route preparation.
- [ ] Implement copy/layout changes and preserve duplicate prevention, swipe delete confirmation, and Save Order authority.
- [ ] Verify Back and Save Order restore/commit the correct order.

### Task 5: Complete Work Mode and Stop Knowledge

**Files:**
- Modify: `app/v2/components/WorkMode.tsx`
- Create: `app/v2/components/StopKnowledgePanel.tsx`
- Modify: `app/v2/styles.css`
- Test: `tests/v2-workflow-ui.test.ts`
- Test: `tests/v2-mounted-workflow.test.tsx`

**Interfaces:**
- Consumes: `WorkdayAggregate`, `getWorkModeAction`, external `navigationTarget`.
- Produces: state-specific Navigate/Arrive/Depart UI and a non-blocking knowledge panel.

- [ ] Add failing tests for state color contracts, arrival/departure metadata labels, Delivery hiding Drop & Hook, and Stop Knowledge open/close focus behavior.
- [ ] Implement the panel and preserve exactly one legal server mutation action.
- [ ] Verify external navigation, copy fallback, retry, and next-stop display.

### Task 6: Implement auto-advance Experience and publish summary

**Files:**
- Modify: `app/v2/workflow/experience.ts`
- Modify: `app/v2/components/ExperienceFlow.tsx`
- Modify: `app/v2/styles.css`
- Test: `tests/v2-primary-workflow.test.ts`
- Test: `tests/v2-mounted-workflow.test.tsx`
- Test: `tests/v2-visual-contract.test.tsx`

**Interfaces:**
- Produces: deterministic waiting-category and bathroom-response score derivation while keeping the existing five-score API.
- Preserves: recovery record, idempotency key, validation, and authoritative publish response.

- [ ] Add tests for gauge auto-advance, final waiting meanings, bathroom branching, derived score mapping, publish summary, failed publish recovery, and no duplicate publish.
- [ ] Implement auto-advance with reduced-motion-safe focus transfer and a sixth local Publish state.
- [ ] Rerun workflow, recovery, and mounted interaction tests.

### Task 7: Add Home Base handoff and premium retained summary

**Files:**
- Modify: `app/v2/components/FinishDay.tsx`
- Modify: `app/v2/styles.css`
- Test: `tests/v2-mounted-workflow.test.tsx`
- Test: `tests/v2-visual-contract.test.tsx`

**Interfaces:**
- Consumes: completed/active `WorkdayAggregate` and existing `onFinish` mutation.
- Produces: local Home Base handoff followed by authoritative Finish Day and retained summary.

- [ ] Add tests for final-stop Home Base handoff, GPS boundary, summary counts, starting odometer, and retained completed state.
- [ ] Implement the handoff and summary without inventing a home-base address or unsaved mileage.
- [ ] Verify retry behavior and dismissal starts a clean setup.

### Task 8: Final visual system, accessibility, and production verification

**Files:**
- Modify: `app/v2/styles.css`
- Modify: `app/globals.css`
- Modify: `design-qa.md`
- Test: `tests/v2-visual-contract.test.tsx`
- Test: `tests/v2-theme-runtime.test.tsx`
- Test: `tests/theme-architecture.test.mjs`

**Interfaces:**
- Produces: one consistent responsive mobile shell and documented verification evidence.

- [ ] Scan user-facing source for forbidden copy and remove every occurrence.
- [ ] Run `npm run lint`, `npm test`, and `npm run validate:artifact`.
- [ ] Start the agent preview, exercise Start Day → Equipment → Route → Navigate → Arrive → Depart → Experience → Publish → Finish Day, and correct approved-scope defects.
- [ ] Record final commands and observations in `design-qa.md`.
