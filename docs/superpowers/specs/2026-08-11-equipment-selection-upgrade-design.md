# StopScore Equipment Selection Upgrade Design

## Goal

Upgrade only the Equipment Selection screen to match the supplied premium dark mobile reference while preserving StopScore's working setup state, validation, recovery, and route workflow.

## Selected Direction

Use a single-column equipment picker with large real vehicle imagery, compact vehicle descriptions, a clear radio/check selection state, and a bottom confirmation bar. This is the closest faithful adaptation of the selected reference that fits the existing product contract.

## Scope

- Keep the canonical equipment types unchanged: Truck Tractor, Truck Bobtail, Straight Truck, and Cargo Van.
- Use the existing local WebP assets for every vehicle.
- Keep equipment details on the next screen and keep all current field validation.
- Let a driver select a card, inspect the selected state, and press Continue to advance.
- Restore the prior selection when returning from Equipment Info.
- Retain dark and light theme support, safe-area padding, scrolling, 44px touch targets, keyboard focus, and screen-reader state.

## Intentional Deviations From The Reference

- Do not add Box Truck as a fifth equipment type because it is not part of the domain contract.
- Do not add search, filters, weight, height, HOS, ELD, IFTA, or “Most Popular” because StopScore has no authoritative data or behavior for those controls.
- Keep the shared StopScore application header instead of recreating device chrome or a second brand header.

## Component And State Design

`EquipmentFlow` owns only the pending visual selection. Selecting a card does not mutate persisted setup state until Continue is pressed. Continue dispatches the existing `select-equipment` action, preserving the reducer's authoritative transition to `equipment-info`. When the user returns, the pending selection initializes from `equipmentDraft.type`.

The equipment option metadata gains presentation-only descriptions. No database, API, domain, recovery schema, or workday payload changes are required.

## Acceptance Criteria

- Given the Equipment Selection screen, when it renders, then all four canonical vehicles appear once with their real image and description.
- Given no selection, when the screen renders, then Continue is disabled and no equipment is persisted.
- Given a vehicle card, when the driver taps or activates it by keyboard, then that card alone exposes the selected visual and accessibility state.
- Given a selection, when Continue is pressed, then the existing reducer advances to Equipment Info with the selected type.
- Given a prior equipment selection, when the driver returns from Equipment Info, then the same vehicle is visibly selected.
- Existing setup recovery, validation, route setup, theme, and workday tests remain green.

## Verification

Run focused mounted selection tests first, then the complete repository tests, type checking, lint, production build, database drift check, and browser visual QA at an Android-sized viewport. Compare the rendered selected state directly with the supplied reference and record the result in `design-qa.md`.
