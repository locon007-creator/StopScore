# StopScore Blueprint — Gap Analysis and Implementation Plan

Date: 2026-08-17
Branch: `arena/01a00eec-stopscore`

Compares the delivered blueprint specification against the code actually present
in this repository. "Already built" rows were verified by reading the source,
not inferred.

## 1. Already built and matching the blueprint

| Blueprint area | Where it lives | Notes |
|---|---|---|
| Core flow Start Day → … → Finish Day | `StopScoreV2App.tsx`, `setup/model.ts` | Stage machine already matches the approved order. |
| 5 equipment types | `setup/model.ts` `EQUIPMENT_OPTIONS` | Exactly the five approved types, with images. |
| Trailer only for Truck Tractor | `EquipmentFlow.tsx`, `TRACTOR_TRAILER_TYPES` | Conditional branch present. |
| 4 approved trailer types | `setup/model.ts` `TRAILER_OPTIONS` | Dry Van, Reefer, Flatbed, Step Deck are the selectable set. Legacy `tanker`/`other` remain **read-only** so existing workdays are not corrupted. |
| 4 stop types | `setup/model.ts` `STOP_TYPE_OPTIONS` | Delivery, Pickup, Drop & Hook, Delivery & Pickup. |
| OSM canonical search, no map | `/api/place-search`, `RouteFlow.tsx` | Debounced listbox, provider IDs, no embedded map. |
| Stop Type opens right after address choice | `setup/model.ts` stage `stop-type` | Already the only path to that stage. |
| Navigate → Arrive → Depart state machine | `workflow/model.ts` `getWorkModeAction` | Single primary action area; illegal actions unreachable. |
| Experience order + gauges + bathroom branch | `workflow/experience.ts` | Order is Yard → Staging → Staff → Waiting → Bathroom. |
| Publish as Stop Knowledge, idempotent | `v2_experiences`, publish session | One publish per stop, local recovery. |
| Dark default, true-white light, theme only in Settings | `theme.tsx`, `SettingsPanel.tsx` | `#FFFFFF` light surface confirmed. |
| Safe areas | `globals.css` (29 uses), `v2/styles.css` (7) | `env(safe-area-inset-*)` already applied. |
| Saved Stops / Saved Routes as separate collections | `saved_stops`, `saved_routes` tables | Distinct tables and endpoints. |
| Word "review" absent from UI copy | verified by test | `tests/` enforces this. |

## 2. Genuine gaps

Ordered by value. G1 is the keystone: three other gaps depend on it.

| ID | Gap | Evidence | Blueprint requirement |
|---|---|---|---|
| **G1** | Arrival/departure **timestamps are recorded but never surfaced**. `v2_stop_events` stores them; `WorkdayAggregate.stops[]` carries only `state`. | `d1-workday-repository.ts` `toAggregate()` omits event times. | "Pressing Arrive automatically records the arrival time"; timestamps "highly readable, white against the status color". |
| **G2** | Work Mode shows a generic `ARRIVAL — Recorded for this stop` strip with **no actual time**. | `WorkMode.tsx` arrival strip. | Show recorded arrival/departure clearly. |
| **G3** | **No Completed Stops section** in Work Mode. | absent from `WorkMode.tsx`. | Collapsible Completed Stops with full activity record. |
| **G4** | Finish Day summary lacks **total work duration** and experience completion status. | `FinishDay.tsx` shows only stops/completed/odometer. | Summary must include total work duration. |
| **G5** | Progress timeline has **no stop numbers**; markers are unnumbered dots. | `v2-progress-marker` elements. | "Stop numbers belong on the progress timeline." |
| **G6** | **Save Route missing from Organize** page (only Save Order). | `RouteFlow.tsx` organize stage. | "Include Save Route on the Organize Route page." |
| **G7** | **No Android Back handling** — no `popstate` listener anywhere. | repo-wide grep: 0 hits. | System Back must navigate backward before exiting. |
| **G8** | Equipment Information collects 4 fields; blueprint lists 8. Missing: license plate, reference #, seal #, cargo/pick count, appointment status/time. | `Equipment` type in `domain/workday.ts`. | Requires schema migration + backward-compatible defaults. |

## 3. Conflicts requiring an owner decision — NOT silently changed

### C1. Waiting Time bands contradict the approved spec

| Category | Blueprint (new) | Approved spec + shipped code |
|---|---|---|
| Quick | 15–45 min | 15–45 min (same) |
| Standard | **1–2 hours** | 30 min – 1 hour |
| Long | **2–4 hours** | 1–2 hours |
| Extremely Delayed | **4+ hours** | 2+ hours |

`AGENTS.md` names `2026-08-12-stopscore-complete-workflow-approved.md` as the
authoritative design, and it states the shipped bands explicitly (line 32).
`tests/v2-primary-workflow.test.ts:70` locks them.

**Not changed.** Rewriting the bands retroactively changes the meaning of every
already-published Stop Knowledge record: a stop published as "Standard" today
means 30–60 min, but would silently be reinterpreted as 1–2 hours. That is
data corruption by redefinition, and it needs an explicit decision plus a
migration strategy for existing rows. Escalated rather than guessed.

### C2. Work Mode state colors

Blueprint: Navigate **blue** → Arrive **red** → Depart **green**.
Shipped `v2-work-mode`: pending blue (`--color-navigating`), navigating amber
(`--color-warning`), arrived green (`--color-success`).

The shipped mapping colors the *state the stop is in*; the blueprint colors the
*action being offered*. These coincide at the ends and differ in the middle.
This is a visual-semantics decision on an approved, QA-passed screen
(`design-qa.md`), so it is raised rather than unilaterally re-themed.

## 4. Implementation plan

Change-controlled: minimum necessary change, integrating into existing
components, no new tables, no redesign of approved screens.

1. **G1** — surface `navigatedAt` / `arrivedAt` / `departedAt` on `WorkdayStop`
   by reading existing `v2_stop_events` rows. Additive and optional, so older
   aggregates stay valid. No schema change.
2. **G2 + G5** — render real times in the Work Mode arrival strip; add stop
   numbers to the timeline.
3. **G3** — collapsible Completed Stops listing each finished stop's record.
4. **G4** — total work duration and experience completion in Finish Day.
5. **G6** — Save Route control on Organize.
6. **G7** — Android Back handling.
7. **G8** — deferred pending decision on schema growth (documented, not silently skipped).
8. **C1/C2** — escalated above; awaiting owner decision.
