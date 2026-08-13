# StopScore Equipment and Home Utility Refinement

## Approved scope

Improve only the Home weather/traffic utilities and the equipment setup sequence. Preserve the route builder, Work Mode, saved data, domain types, validation, navigation, theme behavior, and owner-only access.

## Home utilities

- Replace the playful duotone weather treatment with restrained single-color line symbols.
- Present Weather and Traffic as balanced utility tiles with compact supporting text.
- Keep both utilities honest external links; do not fabricate live conditions or traffic data.
- Preserve the existing Home photograph, logo, greeting, primary action, and GPS disclaimer.

## Equipment selection

- Convert the vehicle list into a horizontal, touch-scrollable snap rail.
- Each card keeps its existing real equipment image and label.
- The active card receives the existing StopScore red selection treatment and visible checked state.
- Include the five existing supported vehicle types without changing their stored identifiers.
- Add a short swipe cue and keep the existing Continue action.

## Trailer selection

- Convert trailer selection into a horizontal snap rail using compact, readable text cards.
- Show the full supported list: Dry Van, Reefer, Flatbed, Step Deck, Tanker, and Other.
- Preserve the current rule that this step appears only after Truck Tractor.
- Preserve the selected trailer value and Continue behavior.

## Equipment information

- Place the existing fields inside a defined raised surface instead of leaving them on an uninterrupted dark background.
- Increase field height, label size, input text size, and spacing for driver readability.
- Use controlled StopScore-red borders on the panel and fields, with a stronger focus treatment.
- Use a lifted graphite surface in Dark mode and true white surfaces in Light mode.
- Preserve field names, validation, focus-on-error behavior, values, limits, and persistence.

## Acceptance criteria

1. Weather and Traffic use professional outline symbols and remain external links.
2. All five equipment choices are horizontally scrollable and snap into position.
3. All six trailer types are horizontally scrollable and selectable.
4. Equipment information is visibly separated by a raised panel and red borders, with controls at least 64 CSS pixels high.
5. Existing setup state, route state, saved values, light/dark themes, keyboard access, and navigation do not regress.

