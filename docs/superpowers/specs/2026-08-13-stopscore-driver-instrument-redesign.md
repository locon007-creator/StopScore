# StopScore Driver Instrument Redesign

## Authorization

Jose authorized an autonomous premium redesign of the existing StopScore Driver OS and asked not to make further design decisions. This document converts that authorization and the previously locked product rules into an implementation contract.

## Diagnosis

The application logic is substantially complete, but the interface has accumulated multiple independent styling passes. The resulting cascade creates inconsistent geometry, competing card treatments, uneven typography, excessive local overrides, and screens that do not feel like one product.

## Approaches considered

1. **Continue adding overrides.** Fastest, but preserves the source of visual drift and makes later changes less predictable.
2. **Rewrite the application.** Maximum freedom, but creates unacceptable risk to authentication, persistence, route state, workflow authority, and saved driver data.
3. **Unified Driver Instrument system — selected.** Preserve React components and all business logic, replace the accumulated presentation layer with one coherent visual system, and make only small semantic markup improvements when they materially improve hierarchy or accessibility.

## Product context

- Primary user: a commercial truck driver working long shifts, often one-handed, in variable lighting, sometimes with limited eyesight.
- Platform: Android-first mobile web application, responsive up to tablet and desktop without stretching phone geometry.
- Primary outcome: prepare equipment, build the route, operate each stop, publish the five-part experience, and finish the day without confusion.
- Protected workflow: Equipment → Trailer when applicable → Equipment Information → Equipment Ready → Create Route → Organize → Prepare → Navigate → Arrive → Depart → Experience → Publish → next stop → Finish Day.

## Art direction

**Driver Instrument:** a calm professional operations console inspired by high-quality native Android tools and automotive instrumentation—not a generic dashboard.

- Dark theme: near-black road-cabin background, graphite surfaces, restrained crimson action color, warm-white text, and semantic blue/orange/green workflow states.
- Light theme: true-white scaffold and primary surfaces, neutral gray secondary surfaces, dark text, and restrained crimson action color.
- Typography: compact display hierarchy, highly readable body text, strong operational numerals, limited weight variation.
- Geometry: 4/8 spacing rhythm, 12px controls, 18px panels, controlled 1px separators, almost no nested cards.
- Icons: one Phosphor outline family; duotone is reserved for a few completion or empty-state moments.
- Imagery: the existing clean mountain-highway photograph appears only on Home. Operational screens use no busy photography.
- Elevation: one low operational elevation and one overlay elevation. No glow on every control and no glass-on-glass nesting.

## Cinematic intensity

- Home and completion: Level 2 expressive product.
- Equipment and route setup: Level 1 calm precision with richer selection feedback.
- Work Mode and Experience: Level 1 operational clarity; state color communicates phase but never replaces text.
- Settings, saved content, dialogs, errors: Level 1 calm precision.

## Composition and hierarchy

Every screen must have exactly three readable priorities:

1. Current task or operational state.
2. Information needed to complete it.
3. One primary next action.

The header remains stable. The main content is the only normal vertical scroller. Fixed or sticky actions must clear the Android gesture area and the keyboard. Horizontal rails are limited to equipment and trailer selection.

## Component system

- App shell and top bar.
- Primary, secondary, icon, and destructive buttons with complete pressed, focused, disabled, and loading states.
- Inputs and search controls with 64px operational height, visible labels, errors, and focus rings.
- Selection cards for equipment, trailers, stop types, and experience answers.
- Operational panels for equipment confirmation, route preparation, active stop, next stop, and day summary.
- Modal and full-height support panels.
- Street progress, workflow state accents, and the five-point StopScore gauge.

## Motion

- Press feedback: 100ms scale or state layer.
- Screen entrance: 220ms opacity and 8px translation.
- Selection change: 160ms border, background, and check-state transition.
- Workflow state transition: 240ms color and opacity only; no looping motion.
- Reduced motion: remove translation and reduce all animation duration to effectively instant.

## State and data protection

No change may alter equipment or trailer identifiers, validation, setup recovery, address search, route ordering, saved stops/routes, authenticated ownership, idempotency, Work Mode state authority, experience recovery, or completion records. Visual work must consume the existing state rather than duplicate it.

## Anti-style

Reject generic dashboard grids, excessive card nesting, red borders on every container, tiny labels, neon glow, fake live data, arbitrary gradients, decorative animation, transparent text surfaces over busy photography, and controls that appear interactive without working behavior.

## Acceptance criteria

1. Home, setup, route, Work Mode, Experience, completion, settings, saved content, and dialogs visibly share one token and component system.
2. Every screen has one dominant action and no competing decorative element.
3. Operational text remains readable at 320px width and enlarged font settings; touch targets are at least 44px and primary controls at least 56px.
4. Header, content scrolling, horizontal rails, sticky actions, safe areas, and form keyboard behavior are predictable on Android.
5. Dark mode is restrained graphite/crimson; Light mode uses true-white scaffold and primary surfaces.
6. The locked driver workflow and all saved or active state continue to pass the complete regression suite.
7. The final implementation reaches at least 17/20 on the Cinematic UI scorecard and scores 2 for product fit, hierarchy, interaction states, accessibility, and authenticity.

