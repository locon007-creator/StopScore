# StopScore Premium Visual Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the complete existing StopScore interface to the approved premium Android-first visual standard and replace the rejected Home photograph without changing protected behavior or data.

**Architecture:** Keep the React component tree, domain model, API routes, D1 schema, persistence, and workflow authority intact. Replace the Home asset and consolidate visual decisions through the existing semantic tokens in `app/globals.css` and the V2 component system in `app/v2/styles.css`; make markup changes only where stronger hierarchy or semantics cannot be achieved safely with CSS.

**Tech Stack:** Next.js/Vinext, React 19, TypeScript, semantic CSS tokens, Phosphor icons, local immutable image assets, Node test runner, react-test-renderer, Sites hosting.

## Global Constraints

- Preserve Navigate → Arrive → Depart → Experience → Publish → next stop → Finish Day.
- Preserve authentication, D1 persistence, workday ownership, idempotency, OSM identity, recovery, theme storage, saved stops/routes, and completed summary retention.
- Do not add an in-app map, GPS, route optimization, invented business information, new database tables, or new workflow states.
- Never use the word “review” in user-facing StopScore copy.
- Dark uses the approved graphite/red identity; Light keeps `#FFFFFF` app background and primary surfaces.
- All controls remain at least 44px and primary driver actions at least 56px.
- Build the complete visual pass before the final verification gate except for a critical compile blocker.
- Publish only owner-only; do not widen access without exact-version confirmation.

---

### Task 1: Replace the Home road photograph

**Files:**
- Modify: `public/assets/stopscore-road-hero.png`
- Modify: `tests/v2-visual-contract.test.tsx`

**Interfaces:**
- Consumes: `Home.tsx` background reference `/assets/stopscore-road-hero.png`.
- Produces: one portrait, clean-air, full-color, mobile-composed immutable Home asset.

- [ ] **Step 1: Record the rejected-image regression contract**

Add an asset test that verifies the Home file remains a portrait raster of sufficient dimensions and that `Home.tsx` continues to use the immutable local path. The test must not attempt subjective pixel classification.

- [ ] **Step 2: Generate the original replacement asset**

Use image generation with this exact direction: realistic clean divided highway toward crisp mountains; natural clean blue/neutral atmosphere; full color; portrait 9:19.5 mobile composition; road vanishing point in lower-middle; no orange smog, fog, pollution, surreal glow, text, logos, close vehicles, or distracting signs.

- [ ] **Step 3: Inspect the image at original resolution**

Reject the generation if the air appears orange/dirty, the road is cropped incorrectly, the image contains text/logos, or the primary composition does not survive a narrow center crop.

- [ ] **Step 4: Place the approved generation at the existing path**

Keep the exact filename so the component and deployment cache contract remain simple. Preserve a lossless or high-quality raster large enough for modern Android DPR.

- [ ] **Step 5: Commit**

```bash
git add public/assets/stopscore-road-hero.png tests/v2-visual-contract.test.tsx
git commit -m "Replace StopScore Home road image"
```

### Task 2: Consolidate the premium visual system and shell

**Files:**
- Modify: `app/globals.css`
- Modify: `app/v2/styles.css`
- Modify: `app/v2/components/AppShell.tsx`
- Modify: `tests/v2-premium-refinement.test.mjs`
- Modify: `tests/v2-color-blend.test.mjs`
- Modify: `tests/theme-architecture.test.mjs`

**Interfaces:**
- Consumes: current semantic color variables and shell class names.
- Produces: a single coherent spacing, type, radius, surface, border, elevation, and state token system used by every V2 screen.

- [ ] **Step 1: Add failing structural visual contracts**

Assert the final system exposes an 8px spacing scale, `12px` control radius, `18px` panel radius, restrained two-level elevation, tabular numeric utility, Android safe-area handling, pure-white Light foundation, and no legacy disabled-edit styling.

- [ ] **Step 2: Normalize semantic tokens**

Keep the existing public variable names but tune dark graphite surfaces, borders, text ramp, focus, brand red, success, warning, navigation, and Light neutral roles. Remove duplicate aliases or overrides only when no existing non-V2 selector depends on them.

- [ ] **Step 3: Refine the shell**

Balance the language control, centered original wordmark, sign-in state, and settings button. Reduce header clutter, preserve safe areas, keep touch targets, and remove generic circular-control decoration where it does not convey hierarchy.

- [ ] **Step 4: Consolidate geometry and elevation**

Replace one-off radii/shadows with the shared control/panel/elevation values. Remove gratuitous glow and stacked card-on-card borders while retaining visible separation and focus.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/v2/styles.css app/v2/components/AppShell.tsx tests/v2-premium-refinement.test.mjs tests/v2-color-blend.test.mjs tests/theme-architecture.test.mjs
git commit -m "Unify StopScore premium visual system"
```

### Task 3: Rebuild Home, settings, equipment, and route setup presentation

**Files:**
- Modify: `app/v2/components/Home.tsx`
- Modify: `app/v2/components/EquipmentFlow.tsx`
- Modify: `app/v2/components/RouteFlow.tsx`
- Modify: `app/v2/components/SettingsPanel.tsx`
- Modify: `app/v2/components/SavedItemsPanel.tsx`
- Modify: `app/v2/styles.css`
- Modify: `tests/v2-visual-contract.test.tsx`

**Interfaces:**
- Consumes: unchanged session, setup reducer, saved-items endpoints, route search, and theme APIs.
- Produces: premium presentation of start-day, equipment, trailer, information, ready, search, stop type, route, organize, prepare, settings, and saved-item states.

- [ ] **Step 1: Add failing screen hierarchy contracts**

Assert Home retains greeting/date/logo/honest utilities/GPS boundary; equipment retains five approved types and the separate tractor trailer step; route retains all stages and real save behavior; settings retains only Light/Dark appearance choices and supporting entries.

- [ ] **Step 2: Refine Home composition**

Make greeting/date, photograph, Start My Day, utility instruments, and GPS boundary the exact visual order. Use restrained scrims that preserve the new image in both themes.

- [ ] **Step 3: Refine setup cards and forms**

Unify equipment imagery, red selection, stable bottom dock, large keyboard-safe fields, ready summary, search results, stop types, swipe cards, organize arrows, and preparation summary with the shared system.

- [ ] **Step 4: Refine settings and saved content**

Use compact full-screen support panels, clear Light/Dark segmented control, restrained rows, separate collapsible saved groups, and honest loading/empty/error states.

- [ ] **Step 5: Commit**

```bash
git add app/v2/components/Home.tsx app/v2/components/EquipmentFlow.tsx app/v2/components/RouteFlow.tsx app/v2/components/SettingsPanel.tsx app/v2/components/SavedItemsPanel.tsx app/v2/styles.css tests/v2-visual-contract.test.tsx
git commit -m "Refine StopScore setup experience"
```

### Task 4: Rebuild Work Mode, Experience, and completion presentation

**Files:**
- Modify: `app/v2/components/WorkMode.tsx`
- Modify: `app/v2/components/WorkflowStatus.tsx`
- Modify: `app/v2/components/StopKnowledgePanel.tsx`
- Modify: `app/v2/components/ExperienceFlow.tsx`
- Modify: `app/v2/components/FinishDay.tsx`
- Modify: `app/v2/styles.css`
- Modify: `tests/v2-visual-contract.test.tsx`
- Modify: `tests/v2-mounted-workflow.test.tsx`

**Interfaces:**
- Consumes: unchanged `WorkdayAggregate`, legal action resolution, record-event, publish, finish, and focus/status APIs.
- Produces: operational Work Mode hierarchy, controlled state atmospheres, premium full-height Experience instruments, and conclusive route/day handoffs.

- [ ] **Step 1: Add failing operational hierarchy contracts**

Assert Street progress precedes equipment and stop content, Current Stop dominates Next Stop, exactly one legal primary action exists, status colors remain Navigate blue/Arrive orange/Depart green, and Experience preserves the locked five-topic order and integer choices.

- [ ] **Step 2: Refine Work Mode**

Build one stable information hierarchy with a compact instrument strip, dominant current stop, quiet next stop, conditional Drop & Hook details, secondary Stop Knowledge, and a fixed large legal action. Use controlled background/state accents without moving content.

- [ ] **Step 3: Refine Experience and Stop Knowledge**

Make each topic a calm full-height instrument surface with consistent icon, title, question, 1–5 selection geometry, endpoints, progress, and action. Keep waiting/bathroom branches and unavailable knowledge behavior unchanged.

- [ ] **Step 4: Refine handoffs and summary**

Create deliberate next-stop, Home Base, Today’s Summary, and Finish Day states using the same typography, surface, status, and action system with no confetti.

- [ ] **Step 5: Commit**

```bash
git add app/v2/components/WorkMode.tsx app/v2/components/WorkflowStatus.tsx app/v2/components/StopKnowledgePanel.tsx app/v2/components/ExperienceFlow.tsx app/v2/components/FinishDay.tsx app/v2/styles.css tests/v2-visual-contract.test.tsx tests/v2-mounted-workflow.test.tsx
git commit -m "Refine StopScore driver workflow presentation"
```

### Task 5: Final verification and owner-only publish

**Files:**
- Modify: `docs/qa/stopscore-premium-visual-rebuild-2026-08-13.md`
- Modify: `tools/stopscore-mcp/data/status.json`

**Interfaces:**
- Consumes: final source tree and owner-only Sites project.
- Produces: fresh automated/browser evidence, exact owner-test version, and private handoff.

- [ ] **Step 1: Run the complete automated gate**

```bash
npm test
npm run lint
npm run validate:artifact
npm run mcp:typecheck
npm run mcp:test
git diff --check
```

Expected: every command exits `0`; 99 existing application tests plus new visual/asset contracts pass; 11 MCP tests pass.

- [ ] **Step 2: Run rendered Android-first inspection**

Start the official Sites preview. Inspect Home in Light/Dark, image crop/readability, shell, equipment, route, Work Mode state fixtures or authenticated flow where available, Experience, settings, empty states, touch targets, overflow, and application console errors.

- [ ] **Step 3: Correct only reproduced final defects**

Apply the minimum visual correction, rerun the affected contract, then rerun the complete gate when source changes.

- [ ] **Step 4: Record evidence**

Create the QA report with exact commands, pass counts, rendered observations, limitations, and protected-state confirmation. Update Builder MCP status with the exact owner-test version and no production confirmation.

- [ ] **Step 5: Publish owner-only and verify terminal status**

Create a Sites checkpoint without changing access. Verify one allowed owner, zero groups, zero external visitors, successful deployment, and the exact published URL/version.

- [ ] **Step 6: Confirm clean integration**

```bash
git status --porcelain
git rev-parse --short HEAD
git rev-parse --short @{u}
```

Expected: clean status and matching local/upstream commits.
