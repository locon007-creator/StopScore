# Final Review Fix Round 1 Report

Date: 2026-08-11

Base: `5648935`

Scope: the four load-bearing findings in `final-review.md`; no Task 1, Task 2, or Task 3 expansion.

## Corrections

1. Setup recovery is now version 3 and bound to the normalized authenticated driver identity. Missing, legacy-unscoped, and mismatched owners fail closed and are removed. Workspace initialization waits for the current authenticated owner's authoritative server state before rendering or persisting that owner's local setup, so a direct account transition cannot rebind the prior driver's draft. Active/completed server workday authority remains ahead of local recovery.
2. Place search now authenticates through a production-boundary handler before query validation, cache lookup, budget use, or Photon provider work. Anonymous requests receive the typed `401 unauthenticated` contract with `no-store`; authenticated success remains private-cacheable. The setup UI reports an expired session without retrying provider work anonymously.
3. Production theme tokens now meet the tested WCAG AA text contrast pairs for brand/destructive/success/navigation actions, tertiary text, and focus indicators. The v2 interactive surface enforces a 44px minimum height, with 44px square icon/menu/action targets where width also matters.
4. Route stage changes move focus to the mounted stage heading and announce the active stage. The theme menu focuses the selected item on open, supports Arrow/Home/End navigation, and restores the invoker on selection, Escape, trigger close, or outside cancel.

## Strict RED Evidence

### Owner binding, authentication, contrast, and target sizing

Command:

```sh
node --test tests/v2-final-review-fix.test.ts tests/v2-setup-ui.test.ts
```

Result before production changes: exit 1, 13 tests, 9 passed, 4 failed.

- The production place-search HTTP boundary module did not exist.
- Dark brand/on-brand contrast was below 4.5:1.
- The computed production control floor was 0px.
- Setup recovery had no owner binding and restored the wrong owner's draft.

### Mounted workflow and focus ownership

Command:

```sh
node --import tsx --test tests/v2-mounted-workflow.test.tsx
```

Result before production changes (after correcting test-harness-only setup): exit 1, 8 tests, 5 passed, 3 failed.

- The production workspace boundary was not independently mountable.
- Route stage transitions did not move focus.
- Theme-menu focus controller behavior was absent.

### Direct authenticated identity transition

Command:

```sh
node --import tsx --test --test-name-pattern='mounted setup wipes' tests/v2-mounted-workflow.test.tsx
```

Result before the owner-resolution guard: exit 1, 1 selected test, 0 passed, 1 failed. While Driver B authority was unresolved, Driver A's draft was incorrectly rebound to `driver-b@example.com`.

## GREEN Evidence

Focused commands after the minimum corrections:

```sh
node --test tests/v2-final-review-fix.test.ts tests/v2-setup-ui.test.ts
node --import tsx --test tests/v2-mounted-workflow.test.tsx
```

Results: 13/13 and 8/8 passing, respectively.

The final focused aggregate additionally covered the production HTTP boundary, recovery, setup, and mounted workflow: 18/18 headless tests and 8/8 mounted tests passing.

## Final Verification

The final tree was verified with:

```sh
npm run test:v2
npm test
npm run typecheck:v2
npm run lint
npm run build
npm run db:generate
git diff --check
```

Final rerun results:

- `test:v2`: 71/71 passing (63 headless, 8 mounted).
- `npm test`: 73/73 passing (63 headless, 8 mounted, 2 legacy); verified build/artifact checks passed.
- `typecheck:v2`: exit 0.
- `lint`: exit 0.
- `build`: exit 0; Worker default export and hosting manifest validated.
- `db:generate`: exit 0, no schema changes to migrate.
- Diff check: clean.

Runtime smoke used the production server on port 5179:

- `/`: 200, 12,850 bytes.
- `/api/session`: 200 with `{"user":null}`.
- `/api/place-search?q=valid%20query`: typed 401 unauthenticated response, 78 bytes.
- `/manifest.webmanifest`: 200, 376 bytes.

The final commit was made only after rerunning and reconfirming the required gates above.

## Self-review and Concerns

- The implemented endpoint is the repository's reviewed `/api/place-search` route (the final-review shorthand called it `/api/v2/places`). Authentication precedes all query/cache/provider paths at the shared production boundary.
- No server authorization, workday uniqueness, authoritative recovery, or legacy persisted business data contract was weakened.
- Unscoped version-2 local setup drafts are intentionally ignored and removed because ownership cannot be proven safely; authoritative server workdays still recover normally.
- React test renderer emits its existing deprecation warning during mounted tests; it does not affect pass/fail results.
- No schema migration was introduced. No preview, deploy, push, or external mutation was performed.
- The reviewer-owned untracked `task-2-review.md` was preserved and excluded from the commit.
