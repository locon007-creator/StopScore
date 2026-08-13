# StopScore Equipment Selection Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a reference-aligned, Android-first Equipment Selection screen without changing StopScore's equipment domain or setup workflow.

**Architecture:** Keep the reducer and persistence contract authoritative. Add presentation metadata to the existing equipment options and keep pending selection local to `EquipmentFlow` until the existing `select-equipment` action is dispatched by Continue.

**Tech Stack:** React 19, TypeScript, Vinext/Vite, Next Image, Phosphor Icons, Node test runner, CSS.

## Global Constraints

- Preserve the four canonical equipment types and all persisted data contracts.
- Do not add fake search, filter, specs, compliance badges, routes, APIs, or schema changes.
- Use existing real vehicle assets and existing theme tokens.
- Preserve WCAG 2.2 AA focus, semantics, contrast, and 44px control floors.

---

### Task 1: Lock Selection Behavior

**Files:**
- Modify: `tests/v2-visual-contract.test.tsx`
- Modify: `app/v2/components/EquipmentFlow.tsx`
- Modify: `app/v2/setup/model.ts`

**Interfaces:**
- Consumes: `EQUIPMENT_OPTIONS`, `SetupState`, `SetupAction`.
- Produces: card-level `aria-pressed`, one pending selected type, and Continue dispatching `select-equipment`.

- [ ] Add a mounted test proving all four real cards render, Continue begins disabled, one card becomes selected, and Continue advances to Equipment Info.
- [ ] Run the focused test and confirm it fails because the current screen advances immediately and has no confirmation bar.
- [ ] Add presentation descriptions and the minimum local selection/Continue implementation.
- [ ] Run the focused test and confirm it passes.

### Task 2: Match The Selected Reference

**Files:**
- Modify: `app/v2/styles.css`
- Modify: `tests/v2-final-review-fix.test.ts`

**Interfaces:**
- Consumes: equipment selection class names and semantic theme tokens.
- Produces: responsive list cards, selected red treatment, bottom confirmation bar, safe-area spacing, and light-theme compatibility.

- [ ] Add a CSS contract test for the one-column list, selected state, sticky action bar, and touch target floor.
- [ ] Run the focused CSS contract and confirm it fails on the current two-column grid.
- [ ] Implement the minimum responsive styling needed to match the reference.
- [ ] Run both focused tests and confirm they pass.

### Task 3: Verify And Ship

**Files:**
- Create or replace: `design-qa.md`
- Modify only if a verified mismatch requires correction: `app/v2/components/EquipmentFlow.tsx`, `app/v2/styles.css`

**Interfaces:**
- Consumes: local Sites preview and the selected reference image.
- Produces: a passed visual QA record and deployable source commit.

- [ ] Run `npm run test:v2`, `npm test`, `npm run typecheck:v2`, `npm run lint`, `npm run build`, `npm run db:generate`, and `git diff --check`.
- [ ] Start the local Sites preview and open it in the cloud browser.
- [ ] Exercise Equipment Selection at a mobile viewport, inspect console health, and capture the selected state.
- [ ] Compare the reference and rendered screen, fix P0/P1/P2 differences, and record `final result: passed` in `design-qa.md`.
- [ ] Commit the scoped change, push the exact source state, save a Sites version, deploy it, and verify the terminal deployment status.
