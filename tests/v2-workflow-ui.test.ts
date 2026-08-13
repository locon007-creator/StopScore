import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("the app renders the real Work Mode, Stop Knowledge, and Finish Day states", async () => {
  const [app, hook, workMode, experience, finish] = await Promise.all([
    readFile(resolve(root, "app/v2/StopScoreV2App.tsx"), "utf8"),
    readFile(resolve(root, "app/v2/useWorkday.ts"), "utf8"),
    readFile(resolve(root, "app/v2/components/WorkMode.tsx"), "utf8"),
    readFile(resolve(root, "app/v2/components/ExperienceFlow.tsx"), "utf8"),
    readFile(resolve(root, "app/v2/components/FinishDay.tsx"), "utf8"),
  ]);
  assert.match(app, /<WorkMode/);
  assert.match(app, /<ExperienceFlow/);
  assert.match(app, /<FinishDay/);
  assert.doesNotMatch(app, /Work Mode continues from this handoff/);
  assert.match(hook, /createWorkflowMutationClient/);
  assert.match(hook, /lifecycle\.begin\(\);\s*setWorkday\(current\)/, "authoritative mutations must invalidate an older restore ticket before applying");
  assert.match(workMode, /StopScore is not a GPS/);
  assert.match(workMode, /Copy address/);
  assert.match(workMode, /aria-label="Active equipment"/);
  assert.doesNotMatch(workMode, /Equipment editing is unavailable during an active workday/);
  assert.match(workMode, /includes\("sign in"\)/);
  assert.match(experience, /includes\("sign in"\)/);
  assert.match(finish, /includes\("sign in"\)/);
  assert.match(experience, /Stop Knowledge/);
  assert.match(experience, /No bathroom access/);
  assert.match(finish, /Finish Day/);
  assert.match(finish, /Today’s Summary/);
  assert.match(finish, /Proceed to Home Base/);
});

test("workflow controls retain accessible focus, live status, scroll, and reduced-motion contracts", async () => {
  const [app, workMode, experience, finish, workflowStatus, styles] = await Promise.all([
    readFile(resolve(root, "app/v2/StopScoreV2App.tsx"), "utf8"),
    readFile(resolve(root, "app/v2/components/WorkMode.tsx"), "utf8"),
    readFile(resolve(root, "app/v2/components/ExperienceFlow.tsx"), "utf8"),
    readFile(resolve(root, "app/v2/components/FinishDay.tsx"), "utf8"),
    readFile(resolve(root, "app/v2/components/WorkflowStatus.tsx"), "utf8"),
    readFile(resolve(root, "app/v2/styles.css"), "utf8"),
  ]);
  assert.match(app, /<WorkflowStatus/);
  assert.match(workflowStatus, /aria-live="polite"/);
  assert.match(workflowStatus, /resolveWorkflowPresentation/);
  assert.match(workMode, /id={`workmode-\$\{stop\.id\}-action`}/);
  assert.match(experience, /const headingId = publishStep/);
  assert.match(experience, /id={headingId}/);
  assert.match(finish, /id="finish-day-title"/);
  assert.match(styles, /\.v2-work-mode/);
  assert.match(styles, /\.v2-experience-flow/);
  assert.match(styles, /overflow-y:\s*auto/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("the package exposes a complete dedicated v2 verification gate", async () => {
  const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  assert.equal(packageJson.scripts?.["test:v2"], "npm run typecheck:v2 && node --test tests/v2-*.test.ts && node --import tsx --test tests/v2-*.test.tsx");
  assert.match(packageJson.scripts?.test ?? "", /npm run test:v2/);
  assert.match(packageJson.scripts?.test ?? "", /npm run build/);
});
