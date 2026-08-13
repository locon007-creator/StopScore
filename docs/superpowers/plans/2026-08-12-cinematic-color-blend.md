# Cinematic Color Blend Implementation Plan

> **For agentic workers:** Execute inline because this is one tightly bounded presentation-only task.

**Goal:** Apply the approved graphite, crimson, and state-color blending across StopScore without altering application behavior.

**Architecture:** Update the existing semantic theme contract in `app/globals.css`, then add V2 presentation overrides in `app/v2/styles.css`. Protect the design contract with a static test and run the complete V2/build verification gate.

**Tech Stack:** CSS custom properties, CSS gradients, Node test runner, Vinext.

## Global Constraints

- Do not modify React components, state, APIs, persistence, labels, navigation, or workflow logic.
- Keep Light scaffold and primary surfaces `#FFFFFF`.
- Keep Navigate blue, Arrived orange, and Ready to Depart green.
- Use StopScore red only for brand, primary, selected, and destructive emphasis.

### Task 1: Protect the visual contract

**Files:**
- Create: `tests/v2-color-blend.test.mjs`

- [ ] Assert the approved graphite tokens, cinematic gradient, softened border, pure-white Light foundation, and state colors.
- [ ] Run the test and confirm it fails before the CSS change.

### Task 2: Apply the cinematic palette

**Files:**
- Modify: `app/globals.css`
- Modify: `app/v2/styles.css`

- [ ] Refine dark semantic tokens to a stepped graphite palette.
- [ ] Blend shared V2 surfaces with subtle gradients and softer depth.
- [ ] Refine primary actions and state atmospheres without changing their meaning.
- [ ] Keep Light overrides pure white and neutral.

### Task 3: Verify and publish

**Files:**
- No source additions.

- [ ] Run the color-contract test.
- [ ] Run the complete V2 test suite.
- [ ] Build and validate the hosting artifact.
- [ ] Publish the approved checkpoint and verify terminal deployment status.
