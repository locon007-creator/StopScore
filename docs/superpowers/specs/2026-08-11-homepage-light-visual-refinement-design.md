# StopScore Homepage Light Visual Refinement

## Scope

Refine only the V2 homepage. Restore the photographic background in Light mode, improve the homepage hierarchy, and add the original StopScore logo. Preserve all navigation, theme controls, setup flows, saved state, business rules, and non-home screens.

## Current Problems

1. Light mode explicitly hides `.v2-home-backdrop`, leaving the homepage visually empty and breaking continuity with Dark mode.
2. The homepage does not display the original StopScore logo even though a high-resolution transparent brand asset already exists.
3. In Light mode, the greeting, primary action, utilities, and disclaimer sit on a flat white field without enough visual grouping or depth.

## Approved Visual Direction

### Background

- Keep `/assets/stopscore-road-mountain.webp` as the homepage image in both themes.
- Preserve the current dramatic Dark-mode treatment.
- In Light mode, show the image through a bright daylight veil: a soft white-to-transparent overlay maintains readable dark text while preserving the road and mountain scene.
- Keep the image decorative and non-interactive.

### Original Logo

- Use `/assets/stopscore-logo-transparent.png`, the highest-resolution transparent original asset in the project.
- Place it above the greeting inside the homepage content, sized as a compact brand mark rather than a dominant splash image.
- Give the logo a restrained dark translucent badge so its white `Score` lettering remains legible in both themes.
- Use descriptive alternative text: `StopScore`.

### Hierarchy and Surfaces

- Keep the greeting and date at the top of the content hierarchy beneath the logo.
- Keep `Start My Day` as the single dominant action and preserve its label, callback, loading state, disabled state, and focus behavior.
- Keep Weather and Traffic as two equal secondary utilities with the same destinations and new-tab behavior.
- In Light mode, use translucent white utility surfaces, a subtle border, and restrained shadow so the road remains visible without reducing readability.
- Keep the GPS disclaimer visible and secondary.

### Responsive and Accessible Behavior

- Fit within the existing fixed-height mobile shell without adding page scrolling.
- Scale the logo and vertical spacing down on short screens.
- Preserve existing minimum touch targets and keyboard focus styles.
- Ensure Light-mode text and controls remain readable over the photographic background.
- Respect reduced-motion behavior already provided by the application.

## Protected Behavior

- Dark-mode homepage treatment.
- Auto theme selection and live device-theme response.
- Theme preference persistence and pre-render application.
- Session loading, error, retry, and authenticated greeting behavior.
- Start-day, Weather, Traffic, navigation, saved data, setup, and active-workday workflows.
- Every screen outside the homepage.

## Acceptance Checks

1. Given Light mode, when the homepage opens, then the mountain-road background is visibly present beneath a bright readable treatment.
2. Given Light or Dark mode, when the homepage opens, then the original StopScore logo is visible and legible above the greeting.
3. Given any session state, when the homepage renders, then Start My Day or the existing error/retry state behaves exactly as before.
4. Given a short mobile viewport, when the homepage renders, then the logo, greeting, CTA, utilities, and disclaimer remain visible without overlap.
5. Given any non-home screen, when it renders, then its layout and behavior are unchanged.

## Verification

- Add source-level and mounted-component assertions for the logo and Light-mode background treatment.
- Run the focused homepage/theme tests, full V2 test suite, lint, and production build.
- Inspect the homepage in Light and Dark mode through the Sites agent preview when available.

