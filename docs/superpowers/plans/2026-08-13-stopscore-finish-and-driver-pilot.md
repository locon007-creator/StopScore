# StopScore Finish and Driver Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the approved StopScore workflow, correct remaining approved-scope defects, verify the complete mobile driver journey, and deliver an owner-only checkpoint ready for Jose’s finishing touches and driver testing.

**Architecture:** Preserve the current V2 React/domain/service/repository boundaries and extend only gaps found against the approved workflow. Client transitions remain local; workday mutations remain server-authoritative and idempotent. The release gate combines automated contracts, artifact validation, and a mobile interaction pass.

**Tech Stack:** React 19, TypeScript 5.9, Next 16/Vinext, Phosphor icons, Drizzle/D1, Node test runner, react-test-renderer, Sites.

## Global Constraints

- Approved source: `docs/superpowers/specs/2026-08-12-stopscore-complete-workflow-approved.md`.
- Do not redesign approved screens, add speculative features, or revive rejected designs.
- Never use “review” in user-facing StopScore copy.
- Light mode app/background/primary surfaces are `#FFFFFF`; dark mode remains unchanged.
- Preserve authentication, D1 persistence, saved records, OSM canonical search, ownership, and idempotency.
- Finish construction before the full test pass; run only focused compile checks when needed to prevent compounded implementation errors.
- Keep the current live version unchanged until Jose confirms the exact owner-only checkpoint.

---

### Task 1: Build the completion matrix from approved requirements

**Files:**
- Create: `docs/qa/stopscore-completion-matrix.md`
- Test: static source inspection only.

**Interfaces:**
- Produces: one row per approved workflow/acceptance criterion with `implemented`, `gap`, or `blocked` status and exact source evidence.

- [ ] Map Home, Settings, Saved, Equipment, Route, Work Mode, Stop Knowledge, Experience, Home Base, Summary, recovery, accessibility, and persistence to exact source files.
- [ ] Record only verified gaps; do not treat visual preference as missing functionality.
- [ ] Convert every verified gap into a bounded file list and acceptance statement.
- [ ] Commit the completion matrix before modifying application behavior.

### Task 2: Correct remaining setup, route, and support-surface gaps

**Files:**
- Modify only as identified: `app/v2/components/Home.tsx`, `SettingsPanel.tsx`, `SavedItemsPanel.tsx`, `EquipmentFlow.tsx`, `RouteFlow.tsx`, `app/v2/setup/*`, and `app/v2/styles.css`.
- Test at release gate: `tests/v2-setup-ui.test.ts`, `tests/v2-visual-contract.test.tsx`, `tests/v2-support-panels.test.tsx`.

**Interfaces:**
- Preserves: `SetupState`, recovery keys, canonical place results, route order, and existing endpoints.
- Produces: complete no-dead-end Start Day → Equipment → Route → Prepare flow.

- [ ] Implement only matrix-confirmed gaps using existing reducers and component patterns.
- [ ] Preserve keyboard-safe inputs, large touch targets, route order, delete confirmation, and separate Saved groups.
- [ ] Remove disabled or duplicate primary actions that conflict with the one-action state contract.
- [ ] Record changed acceptance rows without running the full suite.
- [ ] Commit the setup/route/support completion slice.

### Task 3: Correct remaining Work Mode, Experience, and Finish Day gaps

**Files:**
- Modify only as identified: `app/v2/components/WorkMode.tsx`, `StopKnowledgePanel.tsx`, `ExperienceFlow.tsx`, `FinishDay.tsx`, `app/v2/workflow/*`, and `app/v2/styles.css`.
- Test at release gate: `tests/v2-workflow-ui.test.ts`, `tests/v2-primary-workflow.test.ts`, `tests/v2-mounted-workflow.test.tsx`.

**Interfaces:**
- Preserves: `getWorkModeAction`, authoritative API mutations, experience idempotency, recovery record, and final workday state.
- Produces: Navigate → Arrive → Depart → Experience → Publish → Next Stop/Home Base → Finish Day with no dead-end.

- [ ] Implement only matrix-confirmed primary-workflow gaps.
- [ ] Keep external navigation separate from server mutation and retain the “not a GPS” boundary.
- [ ] Preserve experience auto-advance, bathroom branching, waiting categories, retry, and single publish.
- [ ] Ensure final-stop advancement reaches Home Base and retained completed summary.
- [ ] Commit the active-day completion slice.

### Task 4: Apply final visual, accessibility, and mobile consistency corrections

**Files:**
- Modify: `app/globals.css`, `app/v2/styles.css`, and only components with matrix-confirmed semantic defects.
- Test at release gate: visual/theme/accessibility contract tests.

**Interfaces:**
- Produces: stable dark/light themes, 44px controls, visible focus, reduced motion, keyboard-safe scrolling, and Android-sized responsive layout.

- [ ] Scan all user-facing copy for forbidden terminology and stale labels.
- [ ] Correct semantic token leaks, pure-white light surfaces, overflow, focus order, dialog labeling, and touch targets.
- [ ] Preserve approved density and layout instead of introducing a new visual direction.
- [ ] Commit the final presentation slice.

### Task 5: Run the single final release gate

**Files:**
- Modify tests only when a test contradicts the approved specification; otherwise fix production source.
- Create: `docs/qa/stopscore-2026-08-13-release.md`

**Interfaces:**
- Produces: exact evidence for lint, type checks, tests, production build, artifact validation, and source hygiene.

- [ ] Run `npm run lint` and record the exit code.
- [ ] Run `npm test` and record passed/failed counts.
- [ ] Run `npm run validate:artifact` and record the exit code.
- [ ] Scan for forbidden copy, secrets, temporary files, and unrelated diffs.
- [ ] Fix root causes and repeat the complete gate until every required command passes.
- [ ] Commit the verified release candidate.

### Task 6: Exercise mobile preview and deliver the driver-pilot checkpoint

**Files:**
- Modify: `docs/qa/stopscore-2026-08-13-release.md`
- Modify application source only for defects reproduced during preview.

**Interfaces:**
- Produces: owner-only immutable checkpoint URL, driver test script, finishing-touches list, and exact known limitations.

- [ ] Start the supported agent preview and inspect Home in dark and pure-white light modes.
- [ ] Exercise the signed-in primary flow when the environment permits; record authentication/environment blockers without bypassing them.
- [ ] Inspect Android-class viewport behavior, text scaling, keyboard safety, dialogs, focus restoration, and reduced motion.
- [ ] Correct reproduced approved-scope defects and rerun the full release gate after source changes.
- [ ] Create and verify one owner-only checkpoint without widening access or replacing the confirmed live version.
- [ ] Return the checkpoint, evidence, driver pilot steps, and finishing-touches list to Jose.

