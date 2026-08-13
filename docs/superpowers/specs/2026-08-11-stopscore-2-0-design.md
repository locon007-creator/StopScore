# StopScore 2.0 Primary Driver Workflow

## Mission

StopScore 2.0 is a full-stack responsive PWA for a commercial truck driver's day-of workflow. It is not a GPS, route optimizer, appointment system, or public review product. It helps a signed-in driver configure equipment, prepare an ordered route from real OpenStreetMap places, operate each stop, publish quick Stop Knowledge, and finish the day with a retained summary.

## Product contract

- User: an individual commercial driver using a Samsung-class phone in the cab.
- Primary workflow: Sign in → Start My Day → Equipment → Equipment Information → Create Route → Organize → Prepare → Navigate → Arrive → Depart → Experience → Publish → next stop → Finish Day.
- Platform: full-stack Next/Vinext PWA on Sites with D1.
- Persistence: authoritative workday state in D1; versioned, validated, 24-hour browser draft only for incomplete setup recovery.
- Approval: no production deployment in this implementation cycle. A verified checkpoint requires the user's explicit approval.
- Success: the automated workflow and failure gates pass, then the real two-stop journey passes in Sites agent preview using real provider results.

## Locked product language

- Never call StopScore a review app. Use Stop Knowledge, experience, report, or rating.
- Equipment: Truck Tractor, Truck Bobtail, Straight Truck, Cargo Van.
- Tractor trailer types: Dry Van, Reefer, Flatbed, Step Deck.
- Stop types: Delivery, Pickup, Drop & Hook, Delivery & Pickup.
- Drop & Hook labels: TRL # dropped, TRL # picked up, Reference #.
- Experience order: Yard Experience, Staging, Staff Experience, Waiting Time, Bathroom Access.
- Scores: whole numbers 1–5 only.
- Waiting choices: Quick, Standard, Long, Extremely Delayed.
- Navigation boundary displays: “StopScore is not a GPS.” Navigate opens an external map using a normalized address and retains a copy fallback.

## UX and visual system

- Stable, safe-area-aware PWA shell with a compact header and bounded phone workspace.
- Calm Apple-Sigma instrument aesthetic: dark default, red primary action, green success, precise hierarchy, limited cards, no decorative clutter.
- True global Light theme uses pure `#FFFFFF` surfaces; Dark and Light persist.
- One primary action per state. Work Mode keeps one spatial layout but changes state color and legal action.
- Touch targets are at least 44px; forms have labels, errors, deterministic focus, keyboard-safe scrolling, live status, and reduced-motion support.
- Responsive behavior covers 360px through large desktop while retaining a phone-like operational column.

## Architecture

- `app/v2/domain`: pure contracts, validation, state transitions, and DTOs.
- `app/v2/server`: workday service plus injected in-memory/D1 repositories. Service owns authorization scope, validation, timestamps, idempotency, and state transitions.
- `app/api/v2`: authenticated HTTP handlers for workday start/restore, stop events, experience publish, finish, and places.
- `app/v2/components`: shell, Home, EquipmentFlow, RouteFlow, WorkMode, ExperienceFlow, FinishDay.
- `app/v2/StopScoreV2App.tsx`: screen orchestration, request ownership, setup recovery, and focus transitions.
- D1 migration is additive and contains only `v2_` tables. Stop row IDs are server-owned and workday-scoped; provider identity is a separate canonical `osm:(node|way|relation):<positive integer>` value.

## State and recovery rules

- Aggregate states: setup, active, completed. Stop states: pending, navigating, arrived, departed, experience_published.
- Server-returned `activeStopIndex` is authoritative; the client never increments it optimistically.
- Consequential actions are single-flight and late responses cannot overwrite newer authoritative state.
- One idempotency key is created per experience draft and reused on retries. Failed publish preserves the draft and does not advance.
- Incomplete setup draft restores equipment values, stage, committed route order, and stops. Unsaved Organize movement never becomes committed order.
- Malformed, stale, or impossible drafts fail closed. Active/setup server data wins. An undismissed completed workday restores Finish Day; dismissal is scoped to its exact workday ID and yields to a new same-day setup.

## Place search reliability

- Photon only; no map view, fake stops, manual fabricated stops, or Nominatim autocomplete.
- U.S.-scoped direct and bounded structured variants share a server-enforced request budget, cache, and coalescing boundary.
- Provider failures are typed and retryable; honest zero results remain distinct.
- Queries never appear in diagnostic logs. Malformed provider payloads are not cached.
- Client current-query ownership prevents stale results, stale selection, and late error/loading writes.

## Security and integrity

- Authenticate before parsing write bodies or opening storage.
- Enforce driver ownership on every repository operation.
- Validate canonical provider IDs server-side before any write.
- Use server-owned stop IDs, atomic D1 batches with transition preconditions, and idempotent replay behavior.
- Never log secrets, identity headers, addresses, or raw queries.

## Verification

- Pure domain and validation tests.
- HTTP/service/D1 integration tests for authentication, tenant isolation, atomicity, idempotency, invalid input, missing resources, stale transitions, cross-driver/later-day stop identity, and no-write rejection.
- Executable behavior tests for setup recovery, route interactions, request ownership, focus, publish retry, and server-authoritative advancement.
- Structural UI/PWA contracts, lint, verified production build, and artifact validation.
- Sites agent preview for exact equipment reload and the full real two-stop mobile journey. External provider outage is a release blocker, not permission to use fake data.

