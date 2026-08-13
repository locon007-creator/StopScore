# StopScore Homepage Light Visual Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a polished photographic Light-mode homepage, add the original StopScore logo, and improve homepage hierarchy without changing Dark mode or application behavior.

**Architecture:** Keep the existing `Home` component and its session/actions intact. Add one semantic brand element to its content and implement the visual treatment through scoped `.v2-home` styles plus Light-theme overrides, with short-viewport adjustments. Extend the existing visual and theme contract tests before production code.

**Tech Stack:** React 19, TypeScript, CSS custom properties, Node test runner, React Test Renderer, Vinext/Vite, Sites.

## Global Constraints

- Modify only the V2 homepage component, its scoped styles, and directly related tests.
- Use `/assets/stopscore-logo-transparent.png` as the original logo asset.
- Preserve Dark mode, Auto theme behavior, theme persistence, session states, links, callbacks, navigation, saved data, and every non-home screen.
- Keep the fixed-height mobile shell usable without introducing homepage scrolling.
- Preserve 44px minimum touch targets and existing focus behavior.

---

### Task 1: Lock the Homepage Visual Contract

**Files:**
- Modify: `tests/v2-visual-contract.test.tsx`
- Modify: `tests/theme-architecture.test.mjs`

**Interfaces:**
- Consumes: `Home` rendered props and the scoped rules in `app/v2/styles.css`.
- Produces: regression coverage for the original logo and visible Light-mode background treatment.

- [ ] **Step 1: Write failing component and theme assertions**

Add a mounted assertion that the homepage contains exactly one image with `src="/assets/stopscore-logo-transparent.png"` and `alt="StopScore"`. Replace the old Light-mode assertion that requires `.v2-home-backdrop { opacity: 0; }` with assertions requiring a visible backdrop, a Light-mode daylight filter, and a non-transparent Light-mode shade.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --import tsx --test tests/v2-visual-contract.test.tsx && node --test tests/theme-architecture.test.mjs`

Expected: FAIL because the logo is absent and Light mode still hides the backdrop.

- [ ] **Step 3: Commit the failing contract tests with the implementation after GREEN**

Do not commit a deliberately failing checkpoint; carry these tests into Task 2.

### Task 2: Add the Original Logo and Premium Homepage Treatment

**Files:**
- Modify: `app/v2/components/Home.tsx`
- Modify: `app/v2/styles.css`
- Test: `tests/v2-visual-contract.test.tsx`
- Test: `tests/theme-architecture.test.mjs`

**Interfaces:**
- Consumes: existing `session`, `onStart`, and `onRetrySession` props without modification.
- Produces: `.v2-home-brand`, its `img`, and Light-mode `.v2-home-backdrop` / `.v2-home-shade` treatment.

- [ ] **Step 1: Add one semantic brand element**

Insert this element at the start of `.v2-home-copy`:

```tsx
<div className="v2-home-brand">
  <img src="/assets/stopscore-logo-transparent.png" alt="StopScore" />
</div>
```

Do not change greeting, date, button, error, utility-link, or disclaimer behavior.

- [ ] **Step 2: Add scoped premium geometry**

Style `.v2-home-brand` as a compact dark translucent badge with a quiet border and blur. Size the image with `object-fit: contain`; refine `.v2-home-content`, copy spacing, utility surfaces, and CTA geometry only where needed to establish a three-level hierarchy.

- [ ] **Step 3: Restore the Light-mode photograph**

Remove the Light override that sets backdrop opacity to zero. In Light mode, keep the image visible with controlled opacity, brightness, contrast, and saturation, then apply a white daylight gradient through `.v2-home-shade`. Use semantic text and border tokens for readable Light-mode content.

- [ ] **Step 4: Add short-viewport adjustments**

Under an existing or new `@media (max-height: 720px)` block, reduce logo size, content padding, vertical gaps, and utility height enough to keep all homepage controls visible without overlap.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --import tsx --test tests/v2-visual-contract.test.tsx && node --test tests/theme-architecture.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 6: Commit the tested homepage change**

```bash
git add app/v2/components/Home.tsx app/v2/styles.css tests/v2-visual-contract.test.tsx tests/theme-architecture.test.mjs
git commit -m "refine homepage light visuals and branding"
```

### Task 3: Verify and Publish the Homepage Refinement

**Files:**
- Verify only; no expected source additions.

**Interfaces:**
- Consumes: completed homepage visual treatment.
- Produces: verified production checkpoint.

- [ ] **Step 1: Run the full automated gates**

Run `npm run test:v2`, `npm run lint`, and `npm test`. Require zero failures and a successful production build.

- [ ] **Step 2: Inspect the homepage visually**

Start the Sites agent preview, inspect Light and Dark homepage states, and check a short mobile viewport when the preview environment is available. Confirm logo legibility, visible Light-mode road image, readable content, clear primary action, and no overlap.

- [ ] **Step 3: Check patch scope**

Run `git status --short`, `git diff --check`, and inspect the final diff. Confirm there are no workflow, data, navigation, or non-home changes.

- [ ] **Step 4: Create and verify the Sites checkpoint**

Checkpoint with message `Refine homepage light visuals and branding`, monitor the exact deployment to a terminal state, then verify it directly through Sites and report the production URL.

