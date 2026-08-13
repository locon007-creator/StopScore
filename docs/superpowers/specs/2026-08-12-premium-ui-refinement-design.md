# StopScore Premium UI Refinement Design

## Goal

Improve the existing interface hierarchy and consistency without changing StopScore workflows, labels, features, navigation, saved data, or business logic.

## Approved visual treatment

- Keep the wordmark visually centered and remove temporary session text from the header while loading.
- Turn the loading view into a deliberate branded status state with clearer hierarchy and less perceived empty space.
- Standardize shared card, control, dialog, and status-state radii, borders, shadows, and spacing.
- Strengthen primary-versus-secondary action hierarchy while preserving all action colors and meanings.
- Add restrained press and entrance feedback with a reduced-motion fallback.
- Preserve the Light theme scaffold and primary surfaces as pure white (`#FFFFFF`).

## Scope boundary

Only `AppShell` header presentation, the loading-state presentation, and shared V2 CSS are changed. Domain models, API calls, persistence, routing, authentication behavior, wording, and workflow components remain unchanged.

## Verification

Add a static visual-contract test for the header, loading state, shared control system, reduced-motion fallback, and pure-white Light foundation. Run V2 type checking, targeted visual tests, the production build, and hosting artifact validation before publishing.
