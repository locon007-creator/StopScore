# StopScore Equipment Rail and Address Autocomplete Design

## Goal

Upgrade two setup steps for Jose's Android workflow without changing the rest of the workday experience:

1. Present the approved equipment categories in one horizontally swipeable rail.
2. Search U.S. businesses and street addresses automatically while the driver types, then dismiss suggestions after a selection.

## Equipment Contract

The equipment choices offered for a new setup are:

1. Truck Tractor (`tractor`)
2. Truck Bobtail (`bobtail`)
3. Box Truck (`box_truck`)
4. Small Box Truck (`small_box_truck`)
5. Cargo Van (`cargo_van`)

Existing stored Straight Truck values remain valid and require no destructive conversion, but Straight Truck is not offered for new selection. The newer Box Truck and Small Box Truck values remain additive. Only Truck Tractor accepts trailer type and trailer number.

The database equipment constraint must be migrated additively and verified against real D1. Existing workday rows, ownership constraints, indexes, and idempotency data must remain intact.

## Equipment Interaction

- Render one horizontal, touch-scrollable rail with five compact image cards and scroll snapping.
- Keep cards large enough for Android touch targets and text scaling; do not squeeze all five cards into the 430px viewport simultaneously.
- Selecting a card turns the entire card into the StopScore brand-red selected surface and displays a checkmark.
- Selection remains pending until the driver presses the fixed bottom Continue action.
- The fixed bottom bar shows the selected equipment image and name as confirmation.
- Returning from Equipment Info restores the selected category and keyboard focus.
- Existing equipment details and saved setup recovery continue to work.

## Address Autocomplete

- Begin a bounded place-search request after at least three trimmed characters and a 300ms idle debounce.
- Reuse the authenticated, U.S.-scoped Photon adapter and its existing validation, timeout, privacy, and stale-request ownership rules.
- Retain the Search button as an explicit accessible fallback and immediate-submit action.
- Render returned business/address suggestions below the input as a listbox-style suggestion panel.
- Keyboard behavior: Arrow Down/Up moves through suggestions, Enter selects, and Escape closes the panel.
- Selecting a suggestion clears the visible suggestion state and moves to the existing Choose Stop Type step with the authoritative provider ID, display name, and address.
- Returning to search shows the selected address in the input but does not reopen stale suggestions.
- Empty, unavailable, unauthenticated, and rate-limited states retain concise existing error handling.

## Protected Behavior

- Stop type selection remains required before a stop is committed.
- Route ordering, duplicate prevention, saved setup recovery, workday start, active workflow, and experience publishing remain unchanged.
- Existing four-type workdays and drafts remain readable.
- No search, filter, equipment specification, or compliance claims are added unless backed by product data.

## Acceptance Evidence

- Domain and real-D1 tests prove all six equipment values are valid and old rows survive migration.
- Mounted UI tests prove five approved cards, red full-card selection, bottom confirmation, Continue, Back, and focus restoration.
- Autocomplete tests prove debounce, newest-query ownership, keyboard selection, and suggestion dismissal.
- A real 430px-wide Android browser pass verifies horizontal scrolling, selection, safe-area confirmation, typing, suggestion selection, and transition to Choose Stop Type.
- Full typecheck, tests, lint, production build, artifact validation, schema generation, and independent review pass before deployment.
