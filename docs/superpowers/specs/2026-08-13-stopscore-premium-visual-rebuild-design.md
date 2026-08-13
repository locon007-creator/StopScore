# StopScore Premium Visual Rebuild — Approved Design

Approved by Jose Adames on 2026-08-13 with the direction: complete premium rebuild; the current Home image is unacceptable.

## Outcome

Raise the existing working StopScore driver application from functional to premium, Android-first product quality without changing its driver workflow, data contracts, authentication, saved content, or server authority.

## Visual benchmark

The repository reference `docs/superpowers/specs/assets/stopscore-approved-mobile-reference.png` is the visual quality benchmark. The rebuild adapts its disciplined dark road-centered hierarchy, red/white/black identity, large actions, clear progress, restrained green status accents, generous spacing, and full-screen experience presentation. It does not copy Android device chrome or introduce decorative clutter.

The app follows Material 3 interaction/accessibility structure with Apple-like restraint: precise alignment, a small token system, deliberate whitespace, obvious state hierarchy, and feedback that never competes with the driver task.

## Home image replacement

Replace `public/assets/stopscore-road-hero.png` with a new original mobile portrait photograph-style asset.

Required art direction:

- Realistic clean divided highway leading toward a crisp mountain landscape.
- Natural full-color early-morning or late-afternoon light with clean blue/neutral air.
- No orange smog, dirty haze, low-lying fog, polluted atmosphere, surreal glow, text, logos, vehicles close to camera, or distracting signs.
- Road vanishing point in the lower-middle area so Home copy and controls remain legible.
- Dark-enough upper and lower regions for white content, achieved through composition and restrained UI scrims rather than muddy image grading.
- Portrait composition designed for approximately 9:19.5 Android screens and responsive center cropping.

## Unified premium system

- Use one 4/8px spacing rhythm, consistent 12px control and 18px panel radii, and a compact elevation scale.
- Use a controlled neutral graphite ramp in Dark and true `#FFFFFF` primary surfaces in Light.
- Reserve StopScore red for the primary action and critical brand emphasis. Use green only for completed/ready status, blue for navigation/Drop & Hook, orange for arrival, and red only when destructive or primary.
- Strengthen the type hierarchy with compact labels, readable 16px body copy, large state titles, and tabular numbers where driver data is scanned.
- Remove excess nested card styling, duplicate borders, gratuitous glow, and inconsistent shadow/radius overrides.
- Keep every actionable control at least 44px and primary driver actions at least 56px.

## Screen direction

### App shell and Home

- Simplify the header into a balanced language control, original centered StopScore wordmark, and compact sign-in/settings actions.
- Give Home three clear priorities: greeting/date, road image, Start My Day.
- Place honest Weather and Traffic actions below the primary action as restrained instrument tiles.
- Retain “StopScore is not a GPS.”
- Ensure Light and Dark both preserve image clarity and readable content without hiding the photograph.

### Equipment and route setup

- Present real equipment imagery with consistent crop, quiet surface treatment, a clear red selection state, and a stable bottom confirmation dock.
- Keep the separate text-only tractor trailer-type step.
- Make equipment fields large, bold, keyboard-safe, and easy to scan for drivers with limited eyesight.
- Make route search, stop type, route cards, organize controls, and preparation summary feel like one system with clear stage hierarchy.

### Work Mode

- Make Work Mode the most operational screen: Street progress first, compact equipment instrument strip second, Current Stop dominant, Next Stop secondary, and one large legal action fixed near the bottom.
- Give Navigate, Arrive, and Depart distinct controlled state colors and background atmosphere without moving core information.
- Retain external navigation, Stop Knowledge, Drop & Hook conditional details, and server-authoritative state.

### Experience and completion

- Present each of the five experience topics as a calm full-height instrument panel.
- Use consistent 1–5 gauge geometry, restrained semantic color, clear progress, and one action area.
- Keep waiting and bathroom branches exactly as approved.
- Make Publish, next-stop handoff, Home Base, Today’s Summary, and Finish Day visually conclusive without confetti or celebration clutter.

### Settings and saved content

- Keep Settings compact with only Light/Dark appearance controls and supporting entries.
- Keep Saved Stops and Saved Routes separate, collapsible, and data-backed.
- Use the same shell, typography, spacing, and surface system as the driver workflow.

## Protected behavior

- Preserve Navigate → Arrive → Depart → Experience → Publish → next stop → Finish Day.
- Preserve authentication, D1 persistence, workday ownership, idempotency, OSM search identity, recovery, theme storage, saved stops/routes, and completed summary retention.
- Do not add an in-app map, GPS, route optimization, invented weather/traffic/business facts, new database tables, or new workflow states.
- Do not use the word “review” in user-facing application copy.
- Historical Stop Knowledge aggregation remains outside this visual rebuild.

## Verification and release

- Build the entire visual pass before running the final verification gate, except for a critical compile blocker.
- At the end run TypeScript, all application tests, accessibility/visual contracts, lint, production build, artifact validation, MCP tests, rendered browser checks, and clean-tree validation.
- Publish only as an owner-only version. Do not add driver or public access until Jose confirms the exact tested version.

## Acceptance criteria

- Every screen appears intentionally designed as one StopScore product rather than a collection of generic cards.
- The Home image is realistic, clean-air, full-color, mobile-composed, and free of the rejected polluted/hazy appearance.
- The main task and next legal action are obvious within one glance on an Android phone.
- Dark and Light themes remain coherent, readable, and consistent.
- No protected behavior or persisted data contract changes.
- The complete final verification and owner-only deployment succeed.
