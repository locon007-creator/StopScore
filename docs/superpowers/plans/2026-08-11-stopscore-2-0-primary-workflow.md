# StopScore 2.0 Primary Driver Workflow Implementation Plan

**Goal:** Rebuild the approved StopScore 2.0 full-stack PWA as an additive, testable driver workflow while keeping the recovered live implementation untouched.

**Global constraints:** Follow the design spec verbatim. Inspect before modify. TDD for every production behavior. Do not use fake stops, maps, Nominatim autocomplete, or the word “review” in product UI. Do not deploy.

### Task 1: Domain, additive schema, and authenticated workflow API

**Files:** Create `app/v2/domain/**`, `app/v2/server/**`, `app/api/v2/**`, additive Drizzle schema/migration, and service/D1/HTTP tests.

1. Add failing domain tests for canonical equipment, stop types, experience topics/order, waiting categories, equipment validation, route validation, stop transitions, and aggregate completion.
2. Implement typed contracts and pure validation/state transitions.
3. Add failing schema tests proving only additive `v2_` tables and required ownership/ordering/state constraints.
4. Implement schema and generated migration without modifying legacy tables.
5. Add failing service, real-D1, and HTTP tests for authentication-before-body/storage, tenant ownership, server-owned workday-scoped stop IDs, canonical OSM provider IDs, start/arrive/depart/publish/finish, atomic conditional writes, idempotency, missing/stale/invalid errors, later-day and cross-driver same-place reuse, and invalid no-write behavior.
6. Implement injected repositories, service, routes, and error mapping.
7. Run focused tests, lint, and verified build. Commit.

### Task 2: PWA shell, Home, equipment, route preparation, and recovery

**Files:** Create `app/v2/components/AppShell.tsx`, `Home.tsx`, `EquipmentFlow.tsx`, `RouteFlow.tsx`, place adapter/route, setup recovery/state modules, `StopScoreV2App.tsx`, `useWorkday.ts`, `styles.css`, PWA manifest, page/layout integration, and UI/behavior tests.

1. Add failing UI and behavior tests for shell, session-gated Start My Day, exact equipment contract, focus/validation, route search/stop types, duplicate prevention, Organize Save/Back, accessible delete dialog, pointer-safe swipe, start single-flight, setup reload recovery, committed route order, invalid storage, and authority precedence.
2. Implement the smallest responsive shell and flows using the locked visual system.
3. Implement Photon U.S. search with bounded direct/structured variants, shared budget/cache/coalescing, typed unavailable/empty results, canonical IDs, PII-safe diagnostics, current-query ownership, retry and focus.
4. Implement versioned 24-hour setup recovery and completed-summary dismissal precedence.
5. Replace the root entry with `<StopScoreV2App />`, preserve legacy files in history, and expose the manifest.
6. Run focused tests, full available tests, lint, and verified build. Commit.

### Task 3: Work Mode, Stop Knowledge, Finish Day, and full regression

**Files:** Create `WorkMode.tsx`, `ExperienceFlow.tsx`, `FinishDay.tsx`, primary workflow/request ownership modules, integrate app/client/styles, and add workflow tests.

1. Add failing tests for legal Navigate/Arrive/Depart actions, exact equipment order, Drop & Hook labels, external navigation/copy, five exact experience labels/order, 1–5 scores, waiting categories, draft preservation, same-key retry, null/malformed responses, authoritative `activeStopIndex`, Finish Day retention, request ownership, focus/live announcements, and sign-in error/cancel behavior.
2. Implement stable state-colored Work Mode, full-screen experience cards, retry-safe publish, authoritative advancement, and completed summary.
3. Integrate real `/api/session` and `/signin-with-chatgpt?return_to=%2F`; never weaken API authentication.
4. Add the complete `test:v2` package gates and run them, lint, and verified build. Commit.

### Task 4: Independent review and Sites preview QA

**Files:** Create `docs/qa/stopscore-2-0-primary-workflow.md`; production edits only through focused failing regressions.

1. Independently review the full branch for spec, security, accessibility, state/data integrity, concurrency, and tests. Fix Important findings through scoped TDD and re-review.
2. Run `npm run test:v2`, `npm run lint`, and `npm run build` fresh.
3. Start a Sites agent preview and test Samsung-class mobile and large viewports, exact equipment reload, real U.S. place results, two-stop Delivery + Drop & Hook journey, Organize, Prepare, Navigate/Arrive/Depart, five experiences, Publish, Finish, Light/Dark, keyboard/focus, manifest, retry/error states, and reload recovery.
4. Never use fake data. If Photon is unavailable, record the exact external blocker and stop before checkpoint/deployment.
5. No production checkpoint or deployment without explicit user approval after all release gates pass.

