# Task 4 Brief — Final Review and Sites Preview QA

## Objective

Independently determine whether the complete rebuilt StopScore 2.0 branch is releasable, then exercise the real product in a Sites agent preview without fake stops or production deployment.

## Final branch review

- Review the entire range from restored spec base `e8e8a44` through current head, not only Task 3.
- Inspect spec compliance, auth/tenant isolation, additive migration compatibility, server/client IDs, validation, atomic/idempotent writes, state/data recovery, cross-operation ownership, Photon error/privacy/budget behavior, WCAG-oriented focus/dialog/touch behavior, PWA manifest, and test realism.
- Reproduce candidates with production-boundary tests or direct real-D1/HTTP probes.
- Critical or Important findings block preview/release and must be fixed by the owning implementer through strict TDD and re-reviewed, up to five rounds.
- Record final review artifacts in this SDD workspace.

## Fresh automated gate

Run fresh from the reviewed head:

- `npm run test:v2`
- `npm test`
- `npm run typecheck:v2`
- `npm run lint`
- `npm run build`
- migration drift and diff hygiene checks

Do not rely solely on prior task reports.

## Sites preview QA

- Use the existing managed Sites project and required agent preview lifecycle.
- Use the cloud browser only for the preview; do not substitute localhost for required preview evidence.
- Test both Samsung-class mobile and large desktop widths when the browser surface permits.
- Test real authentication/sign-in boundary without bypassing server auth.
- Exact equipment recovery: enter realistic tractor/trailer fields, reload mid-setup, and prove exact stage/values restore.
- Query Photon for at least three real U.S. places. Distinguish honest empty from typed unavailable and verify Retry/focus.
- Only if real provider suggestions are returned, build a two-stop route using Delivery plus Drop & Hook; verify committed order, Organize Save/Back, delete dialog, Prepare, recovery, and start.
- Exercise Navigate → Arrive → Depart → five Stop Knowledge cards → Publish → next stop → Finish Day with authoritative advancement and reload recovery.
- Verify Light and Dark, keyboard focus, visible focus ring, long route progress, error recovery, manifest metadata, safe-area/overflow behavior, and reduced motion/text scale where available.
- Never inject fake/manual stops or weaken auth to complete QA.
- If preview/runtime egress to Photon is unavailable, record the exact external blocker, classified UI behavior, and all independently verified non-provider behavior.

## Deliverables and deployment boundary

- `docs/qa/stopscore-2-0-primary-workflow.md`
- `.superpowers/sdd/.../task-4-report.md`
- Reviewer report(s) and any TDD fix reports
- No push, production checkpoint, or deployment. Production publishing requires a separate explicit approval after all release gates pass.
