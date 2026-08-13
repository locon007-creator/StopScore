# StopScore Equipment and Trailer Step Design

## Approval source

Jose approved the supplied equipment setup storyboard and asked to build it. The current “continue building the app” instruction resumes that approved StopScore scope and does not authorize Timesheet work or unrelated StopScore changes.

## Goal

Make equipment setup direct and driver-friendly: choose one real vehicle, choose a trailer immediately when Truck Tractor is selected, then enter large, clear equipment details.

## Approved flow

1. Show the prompt **“What are you driving today?”**.
2. Show five real-vehicle cards in this order: **Truck Tractor, Truck Bobtail, Small Box Truck, Box Truck, Cargo Van**.
3. Keep selection visual, immediate, and reversible. The selected vehicle uses the existing full red card treatment and visible checkmark.
4. When **Truck Tractor** is selected, reveal a text-only trailer chooser on the same screen. Do not show trailer images.
5. Trailer choices are **Dry Van, Reefer, Flatbed, Step Deck, Tanker, Other**.
6. Truck Tractor cannot continue until a trailer choice is selected. Every other vehicle can continue after its vehicle selection.
7. Continue opens **Equipment Information**. Returning to the selection screen restores both the vehicle and trailer choice.
8. Equipment Information uses large persistent labels and large controls for **Truck Number** and **Starting Odometer (MI)**. Truck Tractor also shows the chosen **Trailer Type** and a **Trailer Number (Optional)** field.
9. Trailer type remains editable by returning to the equipment selection screen. No duplicate trailer dropdown appears on Equipment Information.

## State and data behavior

- The pending vehicle and trailer choice remain local until Continue.
- The existing setup reducer remains authoritative for the transition to Equipment Information.
- Existing saved drafts and workdays remain readable.
- Adding Tanker and Other is additive; it does not rename or delete existing trailer values.
- Non-tractor equipment clears hidden trailer state exactly as the existing flow does.
- Trailer number remains optional for Truck Tractor, matching the current domain behavior.

## Protected behavior

- Route search, stop-type selection, organizing, preparation, Work Mode, Stop Knowledge, Finish Day, sign-in, theme selection, and homepage behavior do not change.
- Existing equipment images and local asset loading remain unchanged.
- Light mode remains pure white and dark mode remains unchanged.
- Existing setup recovery, ownership, validation, and persisted workday data remain intact.
- No trailer imagery, equipment specifications, compliance claims, filters, or extra setup screens are added.

## Accessibility and layout

- Every choice is a real button with visible focus and `aria-pressed` state.
- Vehicle and trailer selection never rely on color alone; selected states also show a checkmark.
- Controls retain the existing 44px minimum target and gain larger equipment-information fields.
- Labels remain visible after entry, numeric odometer input keeps the numeric keyboard, validation preserves entered values, and errors focus the first invalid field.
- The horizontal equipment rail, fixed confirmation dock, safe-area support, light/dark themes, and reduced-motion behavior remain.

## Acceptance criteria

- The five approved vehicle cards render once in the approved order with real images.
- Selecting Truck Tractor reveals all six text-only trailer choices and keeps Continue disabled until one is selected.
- Selecting any non-tractor hides the trailer chooser and clears its pending choice.
- Continue carries the selected tractor trailer type into Equipment Information.
- Equipment Information shows large, clear fields and no trailer-type dropdown.
- Back restores the exact pending vehicle and trailer selections.
- Tanker and Other validate, persist, restore, and display in Work Mode.
- Existing setup, workflow, persistence, theme, and production-build checks pass.

