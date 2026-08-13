# StopScore Equipment and Home Utility Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine Home utilities and make the equipment/trailer setup easier to scan and select on an Android phone.

**Architecture:** Keep the existing React setup reducer and domain contracts unchanged. Modify presentation in `Home.tsx`, `EquipmentFlow.tsx`, and the final cascade layer in `styles.css`; protect the requested visible behavior with mounted and parsed-CSS tests.

**Tech Stack:** React, TypeScript, Vinext, Phosphor icons, CSS, Node test runner, react-test-renderer.

## Global Constraints

- Preserve existing equipment and trailer identifiers, validation, persistence, and workflow state.
- Do not change route building, Work Mode, Experience, settings, authentication, or access control.
- Keep Light mode true white and Dark mode graphite.
- Maintain 44px minimum touch targets and visible keyboard focus.
- Do not display invented weather or traffic data.

---

### Task 1: Lock the updated visible contract

**Files:**
- Modify: `tests/v2-visual-contract.test.tsx`
- Modify: `tests/v2-final-review-fix.test.ts`

**Interfaces:**
- Consumes: `Home`, `EquipmentFlow`, production CSS.
- Produces: regression coverage for professional utility icons, horizontal rails, six trailers, and enlarged fields.

- [ ] **Step 1: Write failing mounted tests**

Assert that the Home utility symbols use the new utility-icon classes, equipment exposes its swipe cue, and trailer buttons equal `Dry Van`, `Reefer`, `Flatbed`, `Step Deck`, `Tanker`, `Other`.

- [ ] **Step 2: Write failing CSS behavior tests**

Parse the production rules and assert horizontal grid auto-flow, horizontal overflow, snap behavior, minimum card widths, raised equipment form surface, red border definition, and minimum 68px input height.

- [ ] **Step 3: Run targeted tests and confirm they fail for the missing presentation**

Run: `node --import tsx --test tests/v2-visual-contract.test.tsx tests/v2-final-review-fix.test.ts`

Expected: failures name the old stacked layout, incomplete trailer list, and missing information-panel treatment.

### Task 2: Implement the minimum presentation change

**Files:**
- Modify: `app/v2/components/Home.tsx`
- Modify: `app/v2/components/EquipmentFlow.tsx`
- Modify: `app/v2/styles.css`

**Interfaces:**
- Consumes: existing `EQUIPMENT_OPTIONS`, `TRAILER_OPTIONS`, setup reducer actions, and theme tokens.
- Produces: unchanged setup actions with new horizontal presentation.

- [ ] **Step 1: Replace Home utility icon treatment**

Use restrained outline icons with dedicated class names and preserve the existing external destinations and text.

- [ ] **Step 2: Expose the complete trailer list**

Render `TRAILER_OPTIONS` directly and keep `select-trailer` unchanged.

- [ ] **Step 3: Add swipe cues and accessible rail semantics**

Label equipment and trailer groups as horizontally scrollable choices without changing selection state.

- [ ] **Step 4: Add final CSS overrides**

Create snap rails, deliberate card proportions, professional utility tiles, and a larger bordered equipment form panel in both themes.

- [ ] **Step 5: Run targeted tests and confirm they pass**

Run: `node --import tsx --test tests/v2-visual-contract.test.tsx tests/v2-final-review-fix.test.ts`

Expected: all targeted tests pass.

### Task 3: Verify and publish the owner checkpoint

**Files:**
- Modify: `docs/qa/stopscore-equipment-weather-refinement-2026-08-13.md`

**Interfaces:**
- Consumes: complete source state.
- Produces: private owner-test deployment and verification record.

- [ ] **Step 1: Run the complete test, lint, build, artifact, and MCP checks**

Run: `npm test && npm run lint && npm run validate:artifact && npm run mcp:typecheck && npm run mcp:test && git diff --check`

- [ ] **Step 2: Inspect the primary flow in the agent preview when available**

Verify Home utilities, equipment swipe/selection, all six trailer choices, equipment field readability, keyboard focus, and Light/Dark rendering.

- [ ] **Step 3: Record exact verification evidence**

Create the QA report with pass counts and any preview limitation.

- [ ] **Step 4: Create and verify the owner-only checkpoint deployment**

Checkpoint the complete requested experience, poll to terminal status, and confirm the current access policy remains custom with one owner and no outside visitors.

