# StopScore 2.0 Primary Workflow QA

Date: 2026-08-11

Status: BLOCKED after partial preview pass

Reviewed head: `5981fd33342685c2b7d431cbeb6802199c1c79c3`

## Automated release gate

- V2 tests: 71/71 PASS
- Full repository tests: 74/74 PASS
- Strict V2 typecheck: PASS
- Lint: PASS
- Production build and Sites artifact validation: PASS
- Migration generation/drift check: PASS
- Diff hygiene: PASS
- Independent branch review: 0 Critical / 0 Important

## Sites preview observations

### Passed

- Root loads through the Sites agent-preview lifecycle.
- StopScore logo renders from the direct static asset after the preview correction; the image reports a nonzero natural width.
- Desktop viewport observed at 1363 × 936 with document width equal to viewport width and no horizontal overflow.
- Header, Home hero, Start My Day action, session-check loading state, and signed-out state render.
- Start My Day while signed out opens the real sign-in dialog.
- Sign-in dialog focuses `Continue to Sign In`; Escape dismisses it and restores focus to Start My Day.
- Theme menu exposes checked radio semantics, focuses the selected option on open, closes after selection, and returns focus to the trigger.
- Light theme sets the root theme to `light` and the body background to pure `rgb(255, 255, 255)`.
- Document title is `StopScore Driver OS`.
- Manifest link is present at `/manifest.webmanifest`; light theme metadata is `#ffffff`.
- App console emitted no application warning/error. The sole observed error belonged to the cloud-browser extension, not StopScore.

### Preview defect found and corrected

The original preview rendered a broken header logo because Vinext emitted an optimizer URL that returned HTTP 400 in the preview runtime. The existing image is now served directly. Production runtime verification proves HTTP 200, `image/png`, a valid PNG signature, immutable caching, and no optimizer URL dependency. Independent re-review passed with no Critical or Important finding.

## External/authentication blocker

The cloud preview is correctly signed out. The primary workflow requires real ChatGPT sign-in and server-authenticated requests. After the user asked QA to continue, the session was still signed out. The supported attempt to open the visible StopScore `Sign In` link was rejected by the Cloud Browser URL policy before navigation. The browser explicitly prohibited workaround, indirect execution, alternate browser surfaces, or policy circumvention. QA therefore stopped before account access rather than bypassing authentication or injecting fake session/stop data.

Direct cloud-browser navigation to the same-origin place-search endpoint was also blocked by the browser environment with `ERR_BLOCKED_BY_CLIENT`; the production-boundary automated probe independently verifies signed-out place search returns typed 401 with `Cache-Control: no-store` before cache, budget, or provider work.

## Not yet verified in real preview

- Authenticated Equipment setup and exact-value reload recovery
- Driver A/Driver B local draft isolation in a live signed-in browser
- Three real U.S. Photon queries and provider Retry behavior
- Two-stop Delivery + Drop & Hook route
- Organize Save/Back and committed order recovery
- Prepare and authoritative Start My Day
- Navigate → Arrive → Depart → five Stop Knowledge cards → Publish
- Server-selected next stop and Finish Day
- Active/completed reload recovery
- Samsung-class mobile viewport, mobile keyboard, text scaling, and reduced-motion emulation
- Direct manifest/install prompt behavior (manifest metadata/link are verified)

## Exact continuation

Resume the same reviewed preview only when the Sites/Cloud Browser environment permits the StopScore sign-in route and provides a supported authenticated handoff. Do not paste credentials into chat. Re-run the blocked matrix using only real provider results and authenticated server state. No production checkpoint or deployment is authorized by this QA record.
