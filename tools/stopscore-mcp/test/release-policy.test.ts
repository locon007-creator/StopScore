import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { StatusStore } from "../src/status-store.ts";

test("release confirmation requires passing evidence and an exact immutable version", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stopscore-release-"));
  const store = new StatusStore(join(directory, "status.json"));

  await assert.rejects(
    store.confirmProductionRelease({
      versionId: "version-141",
      confirmationText: "I confirm version-141 for production",
    }),
    /passing release evidence/,
  );

  await store.recordVerification({
    idempotencyKey: "release-gate-141",
    versionId: "version-141",
    command: "npm test",
    status: "passed",
    summary: "All automated release tests passed.",
    requiredForRelease: true,
  });

  await assert.rejects(
    store.confirmProductionRelease({
      versionId: "version-142",
      confirmationText: "Looks good",
    }),
    /exact version/,
  );

  const confirmed = await store.confirmProductionRelease({
    versionId: "version-141",
    confirmationText: "I confirm version-141 for production",
  });

  assert.equal(confirmed.releaseConfirmation?.versionId, "version-141");
});

test("failed required verification keeps the release blocked", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stopscore-release-"));
  const store = new StatusStore(join(directory, "status.json"));

  await store.recordVerification({
    idempotencyKey: "release-gate-failed",
    versionId: "version-141",
    command: "npm test",
    status: "failed",
    summary: "One primary workflow test failed.",
    requiredForRelease: true,
  });

  const status = await store.read();
  assert.equal(status.releaseReady, false);
  assert.equal(status.blockers.length, 1);
});

