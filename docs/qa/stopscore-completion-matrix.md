# StopScore Completion Matrix

Date: 2026-08-13

Approved source: `docs/superpowers/specs/2026-08-12-stopscore-complete-workflow-approved.md`

## Protected state and data

| Area | Persistence/authority | Required preservation |
|---|---|---|
| Theme | `stopscore-driver-preferences` local storage | Selected Light/Dark mode and unrelated preference keys survive reload. |
| Setup draft | Owner-scoped local recovery record | Equipment, trailer, stops, and order survive navigation/reload for the same driver only. |
| Workday | D1 `v2_workdays`, `v2_stops`, `v2_stop_events` | Server-authoritative state, ownership, active stop index, and idempotency remain unchanged. |
| Experience | D1 `v2_experiences` plus local recovery | One publish per stop; failed/uncertain publish remains recoverable. |
| Saved content | D1 `saved_stops`, `saved_routes` | Existing records and driver ownership remain unchanged. |

## Approved workflow coverage

| Requirement | Status before final pass | Evidence or bounded gap |
|---|---|---|
| Home greeting, date, original logo, weather/traffic links, GPS boundary | Verified | `Home.tsx` uses the original assets and honest external-check actions; mounted and browser checks passed. |
| Compact Light/Dark settings with pure-white Light | Implemented | `SettingsPanel.tsx`, `theme.tsx`, semantic Light tokens in `globals.css`. |
| Saved Stops and Routes as separate collapsible groups | Implemented | `SavedItemsPanel.tsx` and existing authenticated endpoints. |
| Equipment choices | Implemented | Five approved equipment cards in `setup/model.ts`. |
| Tractor-only trailer selection | Implemented with legacy-read compatibility | Setup exposes only Dry Van, Reefer, Flatbed, and Step Deck. The domain/schema continue reading legacy Tanker/Other records so existing workdays are not corrupted or hidden. |
| Large equipment information and Equipment Ready | Implemented | `EquipmentFlow.tsx`; optional trailer number and validation/recovery present. |
| Search → Stop Type → Route List → Organize → Prepare | Verified | Route cards save through the real saved-stop endpoint, and Organize instructions match the implemented arrow controls. |
| Canonical OSM search with no map | Implemented | `/api/place-search`, search ownership, keyboard listbox, and provider IDs. |
| Work Mode Navigate → Arrive → Depart | Verified | The screen exposes exactly the server-authoritative legal action and no invented hours or disabled false affordances. |
| Street progress, Current/Next Stop, equipment strip, Drop & Hook only | Implemented | `WorkMode.tsx` and workflow model; Drop & Hook details are conditional. |
| Stop Knowledge non-blocking | Implemented for unavailable data | Modal opens without blocking Work Mode and communicates the empty state. Historical aggregate data is not yet exposed; this is retained as a disclosed next-phase limitation rather than inventing data or widening the approved persistence model. |
| Experience order, integer gauges, waiting categories, bathroom branch, publish summary | Implemented | `ExperienceFlow.tsx`, `workflow/experience.ts`, recovery and idempotent publish clients. |
| Next-stop advancement and final Home Base handoff | Implemented | Server increments active index; `FinishDay.tsx` provides safe Home Base handoff without inventing an address. |
| Retained completed summary and Finish Day | Implemented | Authoritative completed workday remains available until owner dismisses the summary. |
| Theme, focus, keyboard, reduced motion, 44px controls | Verified | The 99-test application gate, production build, artifact validator, browser interaction pass, and computed 44px control checks passed. |

## Bounded correction set

1. Replace invented Home weather/traffic values with honest external-check actions.
2. Remove unapproved local-ready route controls/state and correct Organize instructions.
3. Remove invented business hours and disabled false affordances from Work Mode while preserving the authoritative action.
4. Keep Stop Knowledge empty-state behavior safe and disclose historical aggregation as a next-phase limitation.

No database table, saved-record shape, workday state, idempotency rule, authentication boundary, or production access policy changes in this correction set.

## Final result

All bounded corrections are complete. Historical Stop Knowledge aggregation remains deliberately deferred to the next phase because it requires a separately approved data product and persistence design; the current app presents a safe, truthful unavailable-data state.
