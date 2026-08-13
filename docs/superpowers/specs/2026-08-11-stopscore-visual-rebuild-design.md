# StopScore Visual Rebuild Design

## Objective

Rebuild the existing StopScore frontend presentation so the production app faithfully matches the approved mobile reference while retaining the current production application, data model, authentication, APIs, persistence, and driver workflow.

The approved visual source is:

- `assets/stopscore-approved-mobile-reference.png`

This is a presentation-layer rebuild, not a new StopScore application.

## Chosen Approach

### Selected: replace the visual layer in the existing Sites project

Keep the existing React/Vinext application and its tested domain, API, D1, authentication, idempotency, and recovery boundaries. Redesign the app shell and screen components against the approved reference.

This is preferred over:

1. **Starting a new Sites app:** fastest route to another visual prototype, but it would discard or duplicate working production behavior.
2. **Applying small CSS patches:** lowest effort, but it cannot correct the current structural mismatch in Home, Work Mode, and Stop Knowledge.

## Visual Contract

### Overall shell

- Mobile-first, safe-area-aware layout optimized for Jose's Android device.
- App-owned content only; do not recreate phone bezels, Android status bars, or navigation chrome from the reference.
- Dark cinematic background with near-black surfaces, soft charcoal borders, restrained glow, and red/green StopScore accents.
- Maximum mobile canvas approximately 430 CSS pixels on larger screens; center it without stretching the phone layout into a desktop dashboard.
- Use one precise sans-serif family, high-contrast type, compact spacing, and large touch targets.
- Preserve the existing Light theme through the same semantic tokens; Dark is the primary reference-matched theme.

### Header

- U.S. language control at left using a real icon/asset.
- StopScore wordmark centered.
- Sign In/driver identity and Settings at right.
- Stable height and alignment across Home and setup states.
- Use an installed icon library for settings and navigation icons; no emoji, text glyph, CSS art, or handcrafted SVG icons.

### Home

- Full-height cinematic road image using the existing time-of-day road assets.
- Greeting includes authenticated driver display name when available.
- Current date below the greeting.
- Large red `Start My Day` or truthful continuation action positioned above the lower utilities.
- Bottom safety message: `StopScore is not a GPS.`
- Weather and traffic values must not be fabricated. If included, they must be real integrations or honest actions such as `View Weather` and `View Traffic`.
- During an active day, the hero center becomes a compact Current Stop → Next Stop summary without changing the authoritative workday state.

### Equipment and route setup

- Preserve every current field, validation rule, route stage, search provider, duplicate rule, swipe behavior, organize semantics, and recovery behavior.
- Restyle setup screens with the same dark instrument-panel language: compact headings, metallic secondary text, restrained cards, red primary actions, and green completion indicators.
- Maintain keyboard-safe scrolling and 44 CSS-pixel minimum targets.

### Work Mode

- Top progress reads `Stop X of N` with a thin street-style line, stop dots, and finish flag.
- Compact equipment strip at the top in this order: Truck #, Trailer Type, TRL #, Odometer.
- Active stop panel contains business name, address, type pill, Current Stop, and Next Stop.
- The legal state action remains the single strong red CTA: Navigate, Arrive, or Depart.
- `Stop Knowledge` is a secondary green-outline action.
- Equipment editing remains truthfully unavailable during an active workday unless a separate server command is later approved and built.
- Drop & Hook details remain conditional and use the existing authoritative data contract.

### Stop Knowledge / experience capture

- Full-screen focused experience card with back navigation and `Share your experience` title.
- Topic icon in a restrained green circular treatment.
- Exact five-topic order remains unchanged.
- Five large score controls use the approved red → orange → yellow → light green → green scale.
- Scale wording uses `Very Bad` through `Excellent`; numeric values remain authoritative integers 1–5.
- One topic per screen, visible `X of 5` progress, and a five-segment progress line.
- Next remains disabled until the current topic is valid; publishing behavior and the retry-stable idempotency key remain unchanged.
- Bathroom and Waiting Time retain their existing special validation and persistence rules.

### Finish Day

- Apply the same dark instrument-panel system and green completion language.
- Preserve the completed summary, stop list, return-home dismissal, and same-day recovery rules.

## Component Boundaries

- `AppShell`: safe areas, centered mobile canvas, header, theme menu.
- `Home`: cinematic hero, greeting/date, honest utility actions, primary day action.
- `EquipmentFlow` and `RouteFlow`: visual restyling only; reducer and persistence interfaces stay unchanged.
- `WorkflowStatus`: screen-change announcement remains the accessibility owner.
- `WorkMode`: reorganize existing authoritative values into the approved visual hierarchy.
- `ExperienceFlow`: preserve reducer/session behavior while replacing card presentation.
- `FinishDay`: visual alignment only.
- `styles.css`: becomes the authoritative StopScore 2.0 component visual system backed by existing global semantic theme tokens.

No API, database, migration, repository, domain, or authentication change is expected for this visual rebuild.

## Protected State and Data

The following cannot regress:

- ChatGPT session and sign-in boundary.
- Owner-scoped 24-hour setup recovery.
- Equipment validation and conditional trailer fields.
- Canonical OSM place identities and provider error states.
- Route ordering, Organize Back/Save semantics, delete confirmation, and swipe ownership.
- Workday start serialization and idempotency.
- Navigate, Arrive, Depart, Publish, and Finish retry identities.
- Server-authoritative active stop index.
- Stop Knowledge recovery, bathroom consistency, waiting categories, and completed summary recovery.
- Light/Dark persistence and pre-render theme restoration.

## Assets

- Use the existing StopScore logo assets, time-of-day road imagery, and equipment imagery where they fit the approved slots.
- Create or optimize individual raster assets only if an approved visible slot lacks a suitable asset.
- Standard UI icons must come from the existing icon dependency or another compatible installed icon library.
- Do not reproduce the composite reference image or its phone frames inside the app.

## Error and Empty States

- Preserve current typed provider, authentication, validation, stale-state, and request failure messages.
- Restyle errors to match the instrument-panel visual system without hiding retry actions.
- Never show fake stops, fake weather, fake traffic, or placeholder business data as real.

## Acceptance Criteria

1. At Android mobile width, Home visually matches the reference's composition, density, palette, road hero, header, and primary action.
2. Work Mode matches the reference's equipment-first, stop-second hierarchy and exposes only the legal authoritative action.
3. Stop Knowledge matches the reference's full-screen card and colored 1–5 gauge while retaining all five real topics.
4. No horizontal overflow occurs at 360, 412, or 430 CSS pixels.
5. Important controls remain at least 44 CSS pixels and critical text meets WCAG 2.2 AA contrast.
6. Keyboard focus, modal trapping, live announcements, and reduced-motion behavior remain intact.
7. Existing V2 domain, D1, API, UI behavior, recovery, and mounted component tests pass.
8. Production build, lint, typecheck, artifact validation, schema drift check, and dependency audit pass.
9. The rendered local preview is compared to the approved reference at the same mobile state; all P0, P1, and P2 design differences are corrected and `design-qa.md` reports `final result: passed`.
10. Only after verification is the same Sites project updated, preserving its URL and access policy.

## Verification Plan

- Add visual contract tests before changing production presentation.
- Run focused tests after each screen conversion.
- Run the complete V2 and legacy test gates.
- Start the existing Sites agent preview and inspect Home, Work Mode, Stop Knowledge, setup, focus, overflow, and console output in the cloud browser.
- Compare the reference and final screenshots through the Product Design design-QA gate.
- Run final production build and dependency audit.
- Deploy the verified commit through the existing Sites checkpoint lifecycle and confirm terminal production status.

## Scope Boundaries

- This rebuild does not add fleet management, voice capture, weather data providers, traffic APIs, active-workday equipment mutation, maps, new database fields, or new navigation destinations.
- Those features require separate product approval and implementation contracts.
- The work changes the frontend presentation and, only where required for visual hierarchy, component markup. Existing business behavior remains authoritative.
