# StopScore Visual Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing StopScore frontend so its Android presentation faithfully matches the approved three-screen reference while preserving every tested production workflow and deploying through the same Sites project.

**Architecture:** Keep the current React/Vinext application, D1 repositories, API handlers, authentication, setup recovery, and workflow state machines unchanged. Add presentation-focused markup and semantic view helpers to the existing components, then replace the V2 stylesheet with a mobile-first instrument-panel system driven by the current light/dark theme tokens.

**Tech Stack:** React 19, TypeScript 5.9, Vinext/Vite, Next Image, Phosphor Icons, Node test runner, react-test-renderer, Sites preview/hosting.

## Global Constraints

- The approved reference is `docs/superpowers/specs/assets/stopscore-approved-mobile-reference.png`.
- Do not reproduce phone bezels, Android system bars, or navigation chrome.
- Do not change API, database, migration, repository, domain, authentication, or idempotency contracts.
- Preserve owner-scoped setup recovery, canonical OSM search, route ordering, legal workday actions, experience recovery, and completed-summary recovery.
- Do not fabricate weather, traffic, stops, equipment, or provider responses.
- Keep all important controls at least 44 CSS pixels and critical text at WCAG 2.2 AA contrast.
- Support 360, 412, and 430 CSS-pixel Android widths without horizontal overflow.
- Use the existing raster assets and Phosphor Icons; do not add emoji, CSS art, or handcrafted SVG icons.
- Keep Light and Dark theme persistence and pre-render restoration intact.

---

### Task 1: Lock the rendered visual contract

**Files:**
- Create: `tests/v2-visual-contract.test.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: `AppShell`, `Home`, `WorkMode`, and `ExperienceFlow` production components.
- Produces: executable assertions for header structure, named-driver greeting/date, honest home utilities, street progress, equipment order, Stop Knowledge action, topic progress, disabled Next behavior, and score labels.

- [ ] **Step 1: Write the failing mounted contract tests**

Add real component tests that render authenticated Home, a two-stop pending Work Mode aggregate, and the first Experience card. Assert the production output contains `Good morning, Jose` or the current time equivalent, a formatted date, `View Traffic`, `StopScore is not a GPS.`, `Stop 1 of 2`, the four equipment labels in canonical order, `Current Stop`, `Next Stop`, `Stop Knowledge`, `Share your experience`, `1 of 5`, numeric score controls 1–5, `Very Bad`, `Excellent`, and a disabled `Next` before selection.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import tsx --test tests/v2-visual-contract.test.tsx`

Expected: FAIL because the current components do not expose the approved header, home, work-mode hierarchy, Stop Knowledge button, or disabled-first-card interaction.

- [ ] **Step 3: Keep the test in the existing V2 gate**

The current `test:v2` glob already includes `tests/v2-*.test.tsx`; verify no script broadening is required. Change `package.json` only if the new test would otherwise be skipped.

- [ ] **Step 4: Commit the RED contract**

```bash
git add tests/v2-visual-contract.test.tsx package.json
git commit -m "test: lock StopScore visual contract"
```

### Task 2: Rebuild the app shell and cinematic Home

**Files:**
- Modify: `app/v2/components/AppShell.tsx`
- Modify: `app/v2/components/Home.tsx`
- Modify: `app/v2/StopScoreV2App.tsx`
- Modify: `app/v2/styles.css`
- Test: `tests/v2-visual-contract.test.tsx`

**Interfaces:**
- Consumes: `SessionState`, the existing `useTheme()` interface, `Home` start/session retry callbacks, and `/signin-with-chatgpt?return_to=%2F`.
- Produces: stable three-zone header; `Home` props `{ session, onStart, onRetrySession }`; time-of-day road hero; authenticated display-name greeting; current date; honest traffic/weather actions; red primary action; safety disclaimer.

- [ ] **Step 1: Implement the stable header with real icons**

Use direct Phosphor imports for `GlobeHemisphereWest`, `GearSix`, and any menu check indicator. Keep the existing theme menu keyboard controller and sign-in URL. Place the supplied StopScore wordmark in the centered header slot and keep left/right controls from shifting it.

- [ ] **Step 2: Implement the Home presentation**

Derive greeting and formatted date at render time, using `session.user.displayName` only for authenticated sessions. Select one existing road asset from the local hour. Render `View Weather` and `View Traffic` as honest external actions without displaying invented readings. Keep the existing session-error and start behavior.

- [ ] **Step 3: Apply the mobile shell tokens and hero layout**

Introduce semantic visual tokens and classes for a 430px centered canvas, safe areas, cinematic image overlays, compact header, content layers, red CTA, dark utility tiles, and light-theme equivalents. Do not use the composite reference image as an app background.

- [ ] **Step 4: Run the focused test and verify Home GREEN**

Run: `node --import tsx --test tests/v2-visual-contract.test.tsx --test-name-pattern="header|Home"`

Expected: PASS for the shell and Home assertions.

- [ ] **Step 5: Run existing auth/theme regressions**

Run: `node --test tests/v2-final-review-fix.test.ts tests/theme-architecture.test.mjs`

Expected: PASS with sign-in gating, theme ownership, and pre-render restoration intact.

- [ ] **Step 6: Commit**

```bash
git add app/v2/components/AppShell.tsx app/v2/components/Home.tsx app/v2/StopScoreV2App.tsx app/v2/styles.css tests/v2-visual-contract.test.tsx
git commit -m "feat: rebuild StopScore mobile home"
```

### Task 3: Recompose Work Mode to match the approved driver instrument panel

**Files:**
- Modify: `app/v2/components/WorkMode.tsx`
- Modify: `app/v2/styles.css`
- Test: `tests/v2-visual-contract.test.tsx`
- Test: `tests/v2-mounted-workflow.test.tsx`

**Interfaces:**
- Consumes: `WorkdayAggregate`, `getWorkModeAction()`, `navigationTarget()`, `EQUIPMENT_DISPLAY_ORDER`, and `onEvent(stopId, action)`.
- Produces: street progress, four-cell equipment strip, stop summary, current/next hierarchy, one legal red action, green-outline Stop Knowledge trigger, existing navigation/copy safety boundary, and unchanged event callback behavior.

- [ ] **Step 1: Extend the failing contract to cover Work Mode hierarchy**

Assert the current stop business/address and type appear before `Current Stop` and `Next Stop`; the next stop uses index `activeStopIndex + 1`; progress has one marker per stop plus a finish treatment; only one enabled state-changing action appears.

- [ ] **Step 2: Verify Work Mode RED**

Run: `node --import tsx --test tests/v2-visual-contract.test.tsx --test-name-pattern="Work Mode"`

Expected: FAIL because current markup lacks the reference hierarchy and Stop Knowledge secondary action.

- [ ] **Step 3: Recompose markup without changing action ownership**

Keep `act()` and `copyAddress()` logic unchanged. Render the equipment strip first, then active-stop card, Current Stop, Next Stop, and actions. The Stop Knowledge control must be non-destructive and must not introduce a new route or server write.

- [ ] **Step 4: Style progress and active-stop panel**

Use CSS borders, pseudo-elements only for non-icon decorative lines, and Phosphor icons for finish/navigation/copy. Preserve focus indicators, state accents, reduced motion, and text selection for addresses.

- [ ] **Step 5: Verify Work Mode GREEN and regressions**

Run: `node --import tsx --test tests/v2-visual-contract.test.tsx tests/v2-mounted-workflow.test.tsx --test-name-pattern="Work Mode|workflow status"`

Expected: PASS, including Navigate → Arrive → Depart and address copy/navigation.

- [ ] **Step 6: Commit**

```bash
git add app/v2/components/WorkMode.tsx app/v2/styles.css tests/v2-visual-contract.test.tsx tests/v2-mounted-workflow.test.tsx
git commit -m "feat: rebuild StopScore work mode"
```

### Task 4: Rebuild Stop Knowledge as the approved five-step experience flow

**Files:**
- Modify: `app/v2/components/ExperienceFlow.tsx`
- Modify: `app/v2/styles.css`
- Test: `tests/v2-visual-contract.test.tsx`
- Test: `tests/v2-mounted-workflow.test.tsx`

**Interfaces:**
- Consumes: `EXPERIENCE_CARD_DEFINITIONS`, `WAITING_OPTIONS`, `reduceExperienceState`, recovery helpers, and the retry-stable publish session.
- Produces: top back control; `Share your experience`; topic icon/title/question; colored 1–5 gauge; `Very Bad`/`Excellent` endpoints; segmented progress; card-validity-gated Next; unchanged special Waiting Time and Bathroom Access inputs; unchanged publish recovery.

- [ ] **Step 1: Add validity-gating RED tests**

Assert `Next` is disabled before a regular topic score is chosen and enabled after selection. Assert Waiting Time requires both score and category. Assert Bathroom Access keeps its explicit Yes/No and condition rules before progression/publish.

- [ ] **Step 2: Verify Experience RED**

Run: `node --import tsx --test tests/v2-visual-contract.test.tsx --test-name-pattern="Stop Knowledge"`

Expected: FAIL because the existing Next button is always enabled and visual endpoint copy is different.

- [ ] **Step 3: Add a pure current-card validity selector**

Define a local typed selector that returns true only when the current card's required values are complete. Use it solely for button disabled state; retain `validateExperienceDraft()` as the authoritative publish validator.

- [ ] **Step 4: Recompose the card and score controls**

Keep radio inputs and labels for accessibility. Add direct Phosphor topic icons mapped by `ExperienceTopicKey`, endpoint labels, five progress segments, and the approved title/question structure. Preserve heading focus on card changes and all recovery effects.

- [ ] **Step 5: Verify Experience GREEN and recovery regressions**

Run: `node --import tsx --test tests/v2-visual-contract.test.tsx tests/v2-mounted-workflow.test.tsx --test-name-pattern="Stop Knowledge|experience"`

Expected: PASS for progression, malformed recovery rejection, sign-in remount recovery, stable key retry, and visual structure.

- [ ] **Step 6: Commit**

```bash
git add app/v2/components/ExperienceFlow.tsx app/v2/styles.css tests/v2-visual-contract.test.tsx tests/v2-mounted-workflow.test.tsx
git commit -m "feat: rebuild StopScore experience flow"
```

### Task 5: Harmonize setup, route, dialogs, and Finish Day

**Files:**
- Modify: `app/v2/components/EquipmentFlow.tsx`
- Modify: `app/v2/components/RouteFlow.tsx`
- Modify: `app/v2/components/FinishDay.tsx`
- Modify: `app/v2/styles.css`
- Test: `tests/v2-setup-ui.test.ts`
- Test: `tests/v2-mounted-workflow.test.tsx`

**Interfaces:**
- Consumes: existing setup reducer/actions, search ownership, swipe reducer, modal focus controller, and finish callback.
- Produces: visually consistent setup cards/forms/stages/route list/dialogs and completed summary without changing state transitions or provider behavior.

- [ ] **Step 1: Add visual-boundary assertions for setup and completion**

Assert setup remains one mobile column at 360px class contracts, form controls retain labels/errors, route rows retain swipe/delete/organize controls, dialogs retain modal semantics, and completed summary retains its stop list and dismissal action.

- [ ] **Step 2: Verify focused RED where new structure is missing**

Run: `node --test tests/v2-setup-ui.test.ts && node --import tsx --test tests/v2-mounted-workflow.test.tsx --test-name-pattern="setup|route|Finish Day"`

Expected: existing behavior passes; any new visual contract assertions fail only for missing presentation hooks.

- [ ] **Step 3: Apply the instrument-panel system**

Restyle existing markup or add presentation-only wrappers. Keep field order, focus refs, search messages, swipe pointer handling, delete trap/restoration, organize Back/Save semantics, prepare action, finish retry, and completed dismissal unchanged.

- [ ] **Step 4: Verify focused GREEN**

Run: `node --test tests/v2-setup-ui.test.ts && node --import tsx --test tests/v2-mounted-workflow.test.tsx --test-name-pattern="setup|route|Finish Day"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/v2/components/EquipmentFlow.tsx app/v2/components/RouteFlow.tsx app/v2/components/FinishDay.tsx app/v2/styles.css tests/v2-setup-ui.test.ts tests/v2-mounted-workflow.test.tsx
git commit -m "feat: unify StopScore setup visuals"
```

### Task 6: Verify, compare, correct, and publish

**Files:**
- Create: `design-qa.md`
- Modify as required by observed P0/P1/P2 differences: `app/v2/components/*.tsx`, `app/v2/styles.css`, `tests/v2-visual-contract.test.tsx`

**Interfaces:**
- Consumes: complete approved specification, reference PNG, verified production build, Sites preview lifecycle, and same Sites project checkpoint.
- Produces: `design-qa.md` with `final result: passed`, verified runtime evidence, and updated production deployment at the existing URL.

- [ ] **Step 1: Run the complete automated gate**

Run: `npm run test:v2 && npm test && npm run lint && npm run typecheck:v2 && npm run build && npm run db:generate && npm audit --omit=dev --audit-level=high && git diff --check`

Expected: all commands exit 0, every test passes, no schema drift, and no high/critical production dependency finding.

- [ ] **Step 2: Start the existing Sites preview**

Run: `sites-preview start "$PWD"`

Open `http://terminal.local:4173/` in the cloud browser. Inspect 360, 412, and 430 CSS-pixel views; Home; sign-in modal; setup; Work Mode; Stop Knowledge; Finish Day; focus; overflow; reduced motion; light/dark; and browser console.

- [ ] **Step 3: Run blocking design QA**

Capture the rendered app at the same viewport/state as the approved reference. Open the reference and rendered capture together, record differences in `design-qa.md`, fix every P0/P1/P2 through a new RED→GREEN test where behavior is involved, and repeat until the report contains `final result: passed`.

- [ ] **Step 4: Run the final gate again after QA corrections**

Run: `npm run test:v2 && npm test && npm run lint && npm run typecheck:v2 && npm run build && npm run db:generate && npm audit --omit=dev --audit-level=high && git diff --check`

Expected: all commands exit 0 with the final exact pass counts recorded.

- [ ] **Step 5: Commit the verified rebuild**

```bash
git add app/v2 tests/v2-visual-contract.test.tsx design-qa.md
git commit -m "feat: match StopScore approved Android design"
```

- [ ] **Step 6: Publish through the existing Sites project**

Create the Sites checkpoint, monitor deployment to a terminal state, open the production URL on Android-sized browser viewport, and verify Home plus the safe reachable workflow. Do not create a new project or change the existing access policy.

- [ ] **Step 7: Report evidence**

Report the unchanged production URL, commit SHA, exact test counts, build/lint/typecheck/audit results, browser/design-QA result, primary workflow result or exact external blocker, and any genuine P3 follow-up only.
