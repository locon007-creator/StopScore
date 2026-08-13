# StopScore UI/UX Corrections — Phase 1 Design

## Goal

Correct the shared header and equipment setup experience without changing StopScore's equipment rail, selected-card treatment, setup state, persistence, validation, or route workflow.

## Approved Direction

Preserve the current horizontally swipeable equipment rail and its large image cards. Add a quiet instruction below the rail—“Swipe right to see more equipment”—with a subtle directional cue and premium, short motion that communicates horizontal continuation without looping or distracting the driver.

## Phase 1 Scope

1. Prevent the centered StopScore brand, driver/sign-in state, and settings control from colliding or visually merging on 320–430px screens.
2. Keep the U.S. language flag visible as a noninteractive language indicator until another language is actually available; it must not look like a dead button.
3. Add the equipment swipe instruction and continuation cue without moving, resizing, reordering, replacing, or restyling the equipment cards.
4. Preserve native horizontal touch scrolling and scroll snapping, with calm press/selection feedback and reduced-motion support.
5. Stop Equipment Info from automatically focusing Truck Number and forcing the mobile keyboard open on entry.

## Protected Behavior

- Five visible equipment categories—Truck Tractor, Truck Bobtail, Box Truck, Small Box Truck, and Cargo Van—and their order, labels, images, and domain values.
- Existing saved Straight Truck workdays remain supported even though Straight Truck is no longer offered for new selection.
- Current card dimensions and horizontal one-card-at-a-time rail.
- Whole-card red selected state, checkmark, confirmation dock, and Continue behavior.
- Existing setup reducer, saved draft recovery, equipment validation, persisted workday data, and route transitions.
- Current light and dark theme behavior.
- Header safe areas, settings/theme menu behavior, sign-in link behavior, and 44px touch targets.
- Address autocomplete and every screen outside the shared header and equipment setup.

## Interaction Details

- The swipe hint sits between the equipment rail and the fixed confirmation dock.
- The text remains readable but visually secondary and includes a rightward directional icon.
- The cue may enter once with a short horizontal translation and fade. It does not pulse, bounce, or repeat.
- The equipment rail remains directly draggable/swipeable. Scroll snapping stays synchronized with the user's gesture.
- Reduced-motion users receive the static hint with no entrance translation.
- Returning from Equipment Info preserves the selected category and existing focus-restoration behavior; first entry to Equipment Info leaves focus neutral so the keyboard opens only after the driver taps a field.

## Acceptance Checks

### Header

- **Given** any supported 320–430px phone width, **when** the header renders with a long driver name or loading label, **then** the brand remains centered and no text overlaps the brand or settings control.
- **Given** the U.S. flag, **when** a driver inspects or taps around it, **then** it is exposed as a language indicator rather than an actionable button.
- **And** sign-in and the theme menu retain their existing behavior.

### Equipment Rail

- **Given** the Equipment Selection screen, **when** it renders, **then** the five approved cards remain in the same horizontal rail and the swipe instruction appears below it.
- **Given** a horizontal swipe, **when** the rail moves, **then** native scrolling and snap behavior remain smooth and no vertical scroll is accidentally captured.
- **Given** an equipment selection, **when** the driver selects and continues, **then** the current red-card selection, confirmation dock, setup state, and transition remain unchanged.

### Equipment Info

- **Given** entry to Equipment Info, **when** the screen appears, **then** no text field is automatically focused and the keyboard remains closed.
- **Given** the driver taps any field, **when** the keyboard opens, **then** the active field and Continue action remain reachable through the existing scroll region.

## Verification

- Add focused component tests before implementation for the noninteractive language indicator, swipe guidance, protected equipment-card structure, and neutral initial form focus.
- Verify those tests fail for the missing Phase 1 behavior, then make the smallest production changes needed to pass.
- Run the focused tests, complete test suite, typecheck, lint, and production build.
- Inspect the rendered header and both equipment screens at small- and large-phone widths in dark and light themes, including reduced motion and keyboard-open behavior when the preview environment is available.

## Explicitly Deferred

Route-list cleanup, Work Mode corrections, Drop & Hook data entry, Stop Knowledge behavior, Bathroom Experience correction, broader typography changes, and desktop layout changes belong to later separately approved phases.
