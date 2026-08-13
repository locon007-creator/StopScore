# StopScore Premium UI Refinement Implementation Plan

> **For agentic workers:** Execute inline because this is one bounded visual-system update.

**Goal:** Improve header balance, loading-state hierarchy, and shared UI consistency without changing application behavior.

**Architecture:** Make two presentation-only JSX adjustments and centralize the rest in shared V2 styles. Protect the approved contract with a focused static test, then run the production verification gate.

**Tech Stack:** React, TypeScript, CSS custom properties, Node test runner, Vinext.

## Global Constraints

- Do not change workflows, labels, features, navigation, APIs, persistence, or saved data.
- Preserve pure-white (`#FFFFFF`) Light scaffold and primary surfaces.
- Preserve existing semantic brand and Work Mode state colors.

### Task 1: Protect the visual contract

**Files:**
- Create: `tests/v2-premium-refinement.test.mjs`

- [ ] Assert that temporary loading identity is absent from the header.
- [ ] Assert the branded loading structure, standardized control radius, entrance feedback, and reduced-motion fallback.
- [ ] Run the focused test and confirm it fails before implementation.

### Task 2: Refine presentation

**Files:**
- Modify: `app/v2/components/AppShell.tsx`
- Modify: `app/v2/StopScoreV2App.tsx`
- Modify: `app/v2/styles.css`

- [ ] Keep authenticated/unauthenticated identity behavior and omit only the temporary loading label.
- [ ] Add semantic loading-state structure without changing the status copy.
- [ ] Standardize shared surfaces, controls, status states, and restrained motion.

### Task 3: Verify and publish

- [ ] Run the focused test and relevant V2 UI tests.
- [ ] Run V2 type checking.
- [ ] Build and validate the production artifact.
- [ ] Publish one checkpoint and verify the terminal deployment status.
