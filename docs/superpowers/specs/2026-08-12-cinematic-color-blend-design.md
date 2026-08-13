# StopScore Cinematic Color Blend Design

## Goal

Improve color blending and visual depth across the existing StopScore Driver OS without changing its workflow, content, data, navigation, or behavior.

## Approved direction

- Keep StopScore dark-first, calm, premium, and cinematic.
- Replace flat or harsh black layers with a controlled graphite scale.
- Use a restrained crimson atmospheric glow near key brand and action areas.
- Reserve StopScore red for the wordmark, primary actions, selections, and destructive actions.
- Preserve blue for Navigate, orange for Arrived, and green for Ready to Depart.
- Soften card borders and shadows so surfaces separate through depth instead of bright outlines.
- Preserve the Light theme scaffold and primary surfaces as pure white (`#FFFFFF`).
- Preserve accessible text contrast and visible keyboard focus.

## Implementation boundary

Only shared semantic color tokens and presentation rules may change. React components, state, APIs, persistence, labels, navigation, and workflow logic remain untouched.

## Verification

- Static visual-contract tests confirm the approved graphite palette, restrained gradients, state colors, and pure-white Light foundation.
- Existing V2 workflow and theme tests must continue to pass.
- The production build and Sites artifact validation must pass before publishing.
