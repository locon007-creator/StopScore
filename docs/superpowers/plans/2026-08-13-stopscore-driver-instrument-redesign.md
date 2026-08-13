# StopScore Driver Instrument Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace StopScore’s accumulated visual patches with one professional Android-first Driver Instrument system while preserving every working driver workflow and saved state.

**Architecture:** Keep the existing React component, reducer, persistence, API, and workflow architecture. Consolidate presentation in the semantic theme tokens and one complete v2 stylesheet, with only minimal component markup changes for hierarchy and accessibility.

**Tech Stack:** React, TypeScript, Vinext, Phosphor icons, CSS, Node test runner, react-test-renderer.

## Global Constraints

- Preserve the exact locked driver workflow and all persisted data contracts.
- Use no new runtime dependencies.
- Keep StopScore owner-only until Jose approves driver access.
- Keep Light mode scaffold and primary surfaces exactly #FFFFFF.
- Keep controls at least 44px and primary controls at least 56px.
- Use only truthful implemented data and controls.

---

### Task 1: Protect the unified presentation contract

**Files:**
- Create: `tests/v2-driver-instrument.test.mjs`
- Modify: `tests/v2-final-review-fix.test.ts`
- Modify: `tests/v2-color-blend.test.mjs`

**Interfaces:**
- Consumes: semantic theme tokens and the rendered v2 component class contract.
- Produces: observable visual-system, shell, control-size, safe-area, and workflow-state assertions.

- [ ] Write tests that parse the final production CSS and assert the shell, type hierarchy, component radii, operational control sizes, one selection system, safe-area action placement, true-white Light mode, and state accents.
- [ ] Run the targeted tests and confirm failure against the accumulated presentation layer.
- [ ] Record the specific missing or contradictory behavior surfaced by the failures.

### Task 2: Consolidate the visual system

**Files:**
- Modify: `app/globals.css`
- Replace: `app/v2/styles.css`

**Interfaces:**
- Consumes: existing semantic token names and every class emitted by v2 components.
- Produces: one deterministic component and screen presentation system.

- [ ] Keep the existing theme source and protected color contracts while completing typography, elevation, spacing, and motion tokens.
- [ ] Replace the v2 stylesheet with coherent shell, primitive, screen, state, theme, responsive, and reduced-motion sections.
- [ ] Remove obsolete v2 selector variants and repeated override layers.
- [ ] Run targeted presentation tests and make them pass.

### Task 3: Refine screen hierarchy without changing behavior

**Files:**
- Modify only when needed: `app/v2/components/AppShell.tsx`
- Modify only when needed: `app/v2/components/Home.tsx`
- Modify only when needed: `app/v2/components/EquipmentFlow.tsx`
- Modify only when needed: `app/v2/components/RouteFlow.tsx`
- Modify only when needed: `app/v2/components/WorkMode.tsx`
- Modify only when needed: `app/v2/components/ExperienceFlow.tsx`
- Modify only when needed: `app/v2/components/FinishDay.tsx`
- Modify only when needed: `app/v2/components/SettingsPanel.tsx`

**Interfaces:**
- Consumes: existing props, reducer actions, and server-authoritative state.
- Produces: clearer semantic grouping while retaining exact control behavior and copy contracts.

- [ ] Remove duplicate or ornamental markup only where the new hierarchy makes it unnecessary.
- [ ] Preserve every event handler, accessible name, field, validation message, and state-dependent action.
- [ ] Run mounted workflow tests and fix any regression before proceeding.

### Task 4: Rendered QA and final verification

**Files:**
- Create: `docs/qa/stopscore-driver-instrument-redesign-2026-08-13.md`
- Modify: `tools/stopscore-mcp/data/status.json`

**Interfaces:**
- Consumes: the complete redesigned application.
- Produces: evidence and an owner-only immutable version.

- [ ] Inspect Home in the agent preview at normal viewing size in Dark and Light themes.
- [ ] Exercise accessible setup and workflow behavior through the mounted tests where owner authentication prevents browser access.
- [ ] Run `npm test && npm run lint && npm run validate:artifact && npm run mcp:typecheck && npm run mcp:test && git diff --check`.
- [ ] Score the implementation against the premium quality gate and record any limitation honestly.
- [ ] Checkpoint and verify the next owner-only deployment, then confirm one allowed owner and zero groups or external visitors.

