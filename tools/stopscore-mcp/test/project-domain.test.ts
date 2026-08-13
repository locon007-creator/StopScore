import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { getProjectContract } from "../src/project-contract.ts";
import { StatusStore } from "../src/status-store.ts";
import { createWorkPackage } from "../src/work-packages.ts";

test("project contract exposes the approved driver workflow and protected boundaries", () => {
  const contract = getProjectContract();

  assert.equal(contract.product, "StopScore Driver OS");
  assert.deepEqual(contract.workflow, [
    "Home",
    "Equipment",
    "Route",
    "Prepare",
    "Navigate",
    "Arrive",
    "Depart",
    "Experience",
    "Publish",
    "Next Stop or Home Base",
    "Finish Day",
  ]);
  assert.equal(contract.releasePolicy.productionRequiresExactVersionConfirmation, true);
  assert.equal(contract.protectedSystems.includes("D1 persisted workdays and saved data"), true);
});

test("status store records one idempotent change and redacts secret-shaped values", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stopscore-status-"));
  const file = join(directory, "status.json");
  const store = new StatusStore(file);

  const input = {
    idempotencyKey: "change-equipment-1",
    summary: "Finished the tractor trailer selection boundary.",
    files: ["app/v2/components/EquipmentFlow.tsx"],
    acceptanceCriteria: ["Truck Tractor opens trailer selection."],
    metadata: { bearerToken: "must-not-be-stored", note: "safe" },
  };

  const first = await store.recordChange(input);
  const second = await store.recordChange(input);
  const persisted = JSON.parse(await readFile(file, "utf8"));

  assert.equal(first.changes.length, 1);
  assert.equal(second.changes.length, 1);
  assert.equal(persisted.changes[0].metadata.bearerToken, "[REDACTED]");
  assert.equal(persisted.changes[0].metadata.note, "safe");
});

test("status store refuses paths outside the StopScore repository", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stopscore-status-"));
  const store = new StatusStore(join(directory, "status.json"));

  await assert.rejects(
    store.recordChange({
      idempotencyKey: "escape-1",
      summary: "Unsafe path",
      files: ["../../etc/passwd"],
      acceptanceCriteria: ["No path escape."],
    }),
    /repository-relative/,
  );
});

test("work packages are bounded to approved requirements", () => {
  const packageResult = createWorkPackage({
    gapId: "work-mode-primary-action",
    goal: "Keep exactly one legal primary action in Work Mode.",
    allowedFiles: ["app/v2/components/WorkMode.tsx", "app/v2/styles.css"],
    acceptanceCriteria: ["Navigate, Arrive, and Depart remain server-authoritative."],
  });

  assert.equal(packageResult.scope, "minimum-change");
  assert.deepEqual(packageResult.allowedFiles, [
    "app/v2/components/WorkMode.tsx",
    "app/v2/styles.css",
  ]);

  assert.throws(
    () => createWorkPackage({
      gapId: "route-optimizer",
      goal: "Add automatic route optimization.",
      allowedFiles: ["app/v2/components/RouteFlow.tsx"],
      acceptanceCriteria: ["Routes are optimized automatically."],
    }),
    /outside the approved StopScore scope/,
  );
});

