# StopScore Complete Workflow — Approved Design

Approved by Jose Adames on 2026-08-12 from the eight uploaded visual boards listed below. These supersede every earlier board and every generated alternative.

## Locked visual truth

- `/workspace/scratch/033dc69837d0/upload/01-7048.png` — Home-equipment workflow and Equipment Ready.
- `/workspace/scratch/033dc69837d0/upload/02-7049.png` — Route building and organize workflow.
- `/workspace/scratch/033dc69837d0/upload/03-7050.png` — Prepare and Work Mode state system.
- `/workspace/scratch/033dc69837d0/upload/04-7051.png` — Five experience topics and Publish.
- `/workspace/scratch/033dc69837d0/upload/05-7052.png` — Stop Knowledge, next stop, Home Base, and Day Summary.
- `/workspace/scratch/033dc69837d0/upload/06-7053.png` — Final route-building copy and density.
- `/workspace/scratch/033dc69837d0/upload/07-7054.png` — Final Work Mode state layout without the hidden Drop & Hook row on delivery stops.
- `/workspace/scratch/033dc69837d0/upload/08-7047.png` — Home, active-day Home, Settings, and Saved Stops & Routes.

The SHA-256 fingerprints captured during implementation are the source-identity lock. No AI-generated replacement imagery may be substituted for these boards.

## Design digest source

This document is the deterministic source for the approved build scope. Application files may change only while this document remains the approved design source.

## Approved workflow

1. Home: start-day and active-day states; language, sign-in, settings, weather, traffic, and the statement “StopScore is not a GPS.”
2. Settings: compact Light/Dark selection with immediate persisted global application; Light uses `#FFFFFF` for app background and primary surfaces.
3. Saved Stops and Routes: separate collapsible groups backed by the existing saved-stop and saved-route endpoints.
4. Equipment: Truck Tractor, Truck Bobtail, Box Truck, Small Box Truck, Cargo Van. Truck Tractor alone opens a separate text-only trailer-type screen for Dry Van, Reefer, Flatbed, or Step Deck. Bobtail and non-tractor equipment skip trailer selection.
5. Equipment information: large fields for Truck #, Starting Odometer (MI), Trailer Type, and optional TRL #. Keyboard-safe layout. Valid details advance to the separate Equipment Ready confirmation, which offers editing or Build Today’s Route.
6. Route: search business/address without an embedded map; full-page stop-type selection; route list; separate Organize Route; Prepare My Route summary with edit actions.
7. Work Mode: Navigate → Arrive → Depart. Preserve one primary action, external maps boundary, Current Stop and Next Stop, equipment strip, street progress, stop-type label, and Drop & Hook details only for Drop & Hook stops.
8. Stop Knowledge: accessible full-screen modal showing an overall integer gauge, five category gauges, update metadata, and driver comments when data exists. It must never block Work Mode when data is unavailable.
9. Quick Experience: Yard Experience → Staging → Staff Experience → Waiting Time → Bathroom Access → Publish. Gauge choices auto-advance. Waiting categories are Quick Wait 15–45 minutes, Standard Wait 30 minutes–1 hour, Long Wait 1–2 hours, and Extremely Delayed 2+ hours. Bathroom uses Yes/No, then Clean/Dirty/Needs improvement when Yes. Publish shows a compact confirmation summary.
10. Route continuation: after publish, authoritative advancement opens the next stop. After the final stop, show Home Base handoff, then Today’s Summary and Finish Day.
11. Completion: retained completed summary, no confetti, no route optimization, no in-app map, and no invented GPS behavior.

## Global constraints

- Never use the word “review” in user-facing StopScore copy.
- StopScore is a driver day-of operations system, not a GPS and not a route optimizer.
- Use one primary action per state, large touch targets, high contrast, and minimal driver cognitive load.
- Preserve existing authentication, D1 persistence, idempotency, OSM canonical place search, workday ownership, and saved data.
- Preserve the user’s existing uncommitted equipment/trailer work and extend it rather than discarding it.
- Implementation and final testing are authorized by the single design approval. Deployment is not included.

## Acceptance criteria

- The production root exposes the complete workflow with no dead-end primary state.
- Navigate, Arrive, Depart, Publish, next-stop advancement, Finish Day, retry, and recovery remain server-authoritative and idempotent.
- Settings, route setup, modal focus, keyboard behavior, reduced motion, empty/error states, and 44px controls pass automated contracts.
- `npm test` and production artifact validation pass after implementation.
