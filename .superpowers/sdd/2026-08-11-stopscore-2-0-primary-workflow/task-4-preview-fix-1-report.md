# Task 4 Preview Fix 1 Report

Date: 2026-08-11

Base: `3b8f63a`

Scope: repair the broken StopScore header logo observed in the reviewed Sites agent preview. No workflow, data, auth, or visual redesign changes.

## Root Cause

The production build rendered the existing `next/image` logo through Vinext's optimizer URL:

```text
/_vinext/image?url=%2Fassets%2Fstopscore-logo-transparent.png&w=34&q=75
```

Against the production server that route returned HTTP 400 with 11 text bytes. The source static asset was healthy: `/assets/stopscore-logo-transparent.png` returned HTTP 200, `image/png`, 612,953 bytes, and decoded as a 1122×1402 RGBA PNG. The optimizer dependency—not the logo file—was the failing boundary.

## RED

Added `tests/production-logo.test.mjs`, which executes the built production Worker, loads the root HTML, verifies the rendered logo URL/dimensions/alt semantics, requests the emitted asset through the production assets binding, and validates status, MIME type, nonzero bytes, and the PNG signature.

Command:

```sh
node --test tests/production-logo.test.mjs
```

Result before production code: exit 1, 1 test, 0 passed, 1 failed. The root emitted the optimizer URL rather than `/assets/stopscore-logo-transparent.png`; width 34, height 34, and `alt=""` were already present.

## GREEN

The existing header `Image` is now explicitly `unoptimized`. This preserves the existing file, 34×34 layout, decorative empty alt text, and Next component while causing Vinext to emit the directly served static asset URL.

Command:

```sh
npm run build && node --test tests/production-logo.test.mjs
```

Result: build/artifact validation exit 0; regression 1/1 passed.

## Final Verification

Final-tree commands and results are recorded before commit:

```sh
node --test tests/production-logo.test.mjs
npm run test:v2
npm test
npm run typecheck:v2
npm run lint
npm run build
npm run validate:artifact
npm run db:generate
git diff --check
```

The runtime smoke starts the built production server and checks the root HTML plus the exact emitted logo path over HTTP, including valid PNG bytes and absence of a logo optimizer dependency.

Final results:

- Focused production-logo regression: 1/1 passing.
- `test:v2`: 71/71 passing (63 headless and 8 mounted).
- Full `npm test`: 74/74 passing (71 v2 and 3 production/legacy artifact tests).
- Scoped typecheck and lint: exit 0.
- Standalone build and explicit artifact validation: exit 0; ESM Worker `default.fetch` and hosting manifest present.
- Schema generation: exit 0, no changes to migrate.
- Runtime root: HTTP 200 and direct `<img src="/assets/stopscore-logo-transparent.png" alt="" width="34" height="34">` semantics.
- Runtime logo: HTTP 200, `image/png`, 612,953 bytes, valid PNG signature.
- Diff check: clean.

## Self-review

- Only the broken header logo instance changed; equipment artwork and all reviewed Task 1–4 behavior remain untouched.
- No image was generated, replaced, recompressed, or copied.
- Dimensions and decorative `alt=""` semantics are unchanged.
- The new regression exercises the built Worker and packaged static asset rather than grepping source code.
- No migration, push, preview, deploy, or external mutation is included.
- Reviewer-owned `task-2-review.md` remains preserved and excluded.
