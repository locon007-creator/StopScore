import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function loadSetup() {
  try {
    return await import("../app/v2/setup/model.ts");
  } catch (error) {
    assert.fail(`Task 2 setup model must exist: ${String(error)}`);
  }
}

async function loadRecovery() {
  try {
    return await import("../app/v2/setup/recovery.ts");
  } catch (error) {
    assert.fail(`Task 2 recovery module must exist: ${String(error)}`);
  }
}

async function loadControllers() {
  try {
    return await import("../app/v2/setup/controllers.ts");
  } catch (error) {
    assert.fail(`Task 2 interaction controllers must exist: ${String(error)}`);
  }
}

test("equipment uses the exact contract, focuses the first error, preserves valid values, and clears hidden tractor state", async () => {
  const { EQUIPMENT_OPTIONS, initialSetupState, setupReducer, validateEquipmentDraft } = await loadSetup();
  assert.deepEqual(EQUIPMENT_OPTIONS.map(option => option.label), [
    "Truck Tractor",
    "Truck Bobtail",
    "Box Truck",
    "Small Box Truck",
    "Cargo Van",
  ]);

  let state = setupReducer(initialSetupState(), { type: "select-equipment", equipment: "tractor" });
  state = setupReducer(state, { type: "change-equipment-field", field: "truckNumber", value: "TRK-42" });
  state = setupReducer(state, { type: "change-equipment-field", field: "odometer", value: "" });
  state = setupReducer(state, { type: "change-equipment-field", field: "trailerType", value: "reefer" });
  state = setupReducer(state, { type: "change-equipment-field", field: "trailerNumber", value: "TRL-9" });
  const invalid = validateEquipmentDraft(state.equipmentDraft);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.focusField, "odometer");

  state = setupReducer(state, { type: "change-equipment-field", field: "odometer", value: "50100" });
  state = setupReducer(state, { type: "select-equipment", equipment: "bobtail" });
  assert.equal(state.equipmentDraft.truckNumber, "TRK-42");
  assert.equal(state.equipmentDraft.odometer, "50100");
  assert.equal(state.equipmentDraft.trailerNumber, "");
  assert.equal(state.equipmentDraft.trailerType, "");
  assert.deepEqual(validateEquipmentDraft(state.equipmentDraft), {
    ok: true,
    value: { type: "bobtail", truckNumber: "TRK-42", odometer: "50100" },
    errors: {},
  });
});

test("tractor selection opens a separate trailer screen and non-tractors skip it", async () => {
  const { initialSetupState, setupReducer } = await loadSetup();
  let state = initialSetupState();
  state = setupReducer(state, { type: "select-equipment", equipment: "tractor" });
  assert.equal(state.stage, "trailer-choice");
  state = setupReducer(state, { type: "select-trailer", trailerType: "dry_van" });
  assert.equal(state.stage, "equipment-info");
  assert.equal(state.equipmentDraft.type, "tractor");
  assert.equal(state.equipmentDraft.trailerType, "dry_van");

  state = setupReducer(state, { type: "back-to-equipment" });
  state = setupReducer(state, { type: "select-equipment", equipment: "bobtail" });
  assert.equal(state.stage, "equipment-info");
  assert.equal(state.equipmentDraft.type, "bobtail");
  assert.equal(state.equipmentDraft.trailerType, "");
  assert.equal(state.equipmentDraft.trailerNumber, "");
});

test("valid equipment opens the approved Equipment Ready checkpoint before route building", async () => {
  const { initialSetupState, setupReducer } = await loadSetup();
  let state = setupReducer(initialSetupState(), { type: "select-equipment", equipment: "tractor" });
  state = setupReducer(state, { type: "select-trailer", trailerType: "dry_van" });
  state = setupReducer(state, { type: "change-equipment-field", field: "truckNumber", value: "124" });
  state = setupReducer(state, { type: "change-equipment-field", field: "odometer", value: "125560" });
  state = setupReducer(state, { type: "change-equipment-field", field: "trailerNumber", value: "48219" });
  state = setupReducer(state, { type: "validate-equipment" });
  assert.equal(state.stage, "equipment-ready");
  assert.deepEqual(state.validatedEquipment, {
    type: "tractor",
    truckNumber: "124",
    odometer: "125560",
    trailerType: "dry_van",
    trailerNumber: "48219",
  });
  state = setupReducer(state, { type: "confirm-equipment-ready" });
  assert.equal(state.stage, "route-search");
});

test("route stages reject provider duplicates and Organize Back restores only the committed order", async () => {
  const { initialSetupState, setupReducer } = await loadSetup();
  const one = { providerId: "osm:node:101", displayName: "Receiver", address: "100 Main St", type: "delivery" as const };
  const two = { providerId: "osm:way:202", displayName: "Warehouse", address: "200 State St", type: "pickup" as const };
  let state = initialSetupState();
  state = setupReducer(state, { type: "add-stop", stop: one });
  state = setupReducer(state, { type: "add-stop", stop: two });
  state = setupReducer(state, { type: "set-stage", stage: "stop-type" });
  const duplicate = setupReducer(state, { type: "add-stop", stop: { ...one, type: "drop_hook" } });
  assert.equal(duplicate.routeError, "This place is already on your route.");
  assert.equal(duplicate.stage, "route-list");
  assert.equal(duplicate.committedStops.length, 2);

  state = setupReducer(state, { type: "begin-organize" });
  state = setupReducer(state, { type: "move-organizing-stop", from: 1, to: 0 });
  assert.deepEqual(state.organizingStops.map(stop => stop.providerId), [two.providerId, one.providerId]);
  state = setupReducer(state, { type: "cancel-organize" });
  assert.deepEqual(state.committedStops.map(stop => stop.providerId), [one.providerId, two.providerId]);

  state = setupReducer(state, { type: "begin-organize" });
  state = setupReducer(state, { type: "move-organizing-stop", from: 1, to: 0 });
  state = setupReducer(state, { type: "commit-organize" });
  assert.deepEqual(state.committedStops.map(stop => [stop.providerId, stop.order]), [[two.providerId, 0], [one.providerId, 1]]);
});

test("swipe ownership is pointer-safe, horizontal-intent gated, cleanup-safe, and ignores controls", async () => {
  const { initialSwipeState, reduceSwipe } = await loadControllers();
  const swipe = reduceSwipe(initialSwipeState, { type: "pointer-down", pointerId: 7, x: 180, y: 30, interactive: false });
  assert.equal(swipe.pointerId, 7);
  assert.equal(reduceSwipe(swipe, { type: "pointer-move", pointerId: 8, x: 50, y: 30 }).revealDelete, false);
  assert.equal(reduceSwipe(swipe, { type: "pointer-move", pointerId: 7, x: 100, y: 90 }).revealDelete, false);
  const revealed = reduceSwipe(swipe, { type: "pointer-move", pointerId: 7, x: 100, y: 55 });
  assert.equal(revealed.revealDelete, true);
  assert.equal(reduceSwipe(revealed, { type: "pointer-up", pointerId: 7 }).revealDelete, true);
  const right = reduceSwipe(swipe, { type: "pointer-move", pointerId: 7, x: 260, y: 35 });
  const marked = reduceSwipe(right, { type: "pointer-up", pointerId: 7 });
  assert.equal(marked.markLocalReady, true);
  assert.equal(marked.offsetX, 0);
  assert.deepEqual(reduceSwipe(swipe, { type: "lost-capture", pointerId: 7 }), initialSwipeState);
  assert.deepEqual(reduceSwipe(initialSwipeState, { type: "pointer-down", pointerId: 3, x: 10, y: 10, interactive: true }), initialSwipeState);
});

test("modal keyboard ownership traps both directions, closes on Escape, and restores a connected fallback", async () => {
  const { handleModalKey, restoreModalFocus } = await loadControllers();
  const focused: string[] = [];
  const first = { isConnected: true, focus: () => focused.push("first") };
  const last = { isConnected: true, focus: () => focused.push("last") };
  let prevented = 0;
  let escaped = 0;
  handleModalKey({ key: "Tab", shiftKey: false, activeElement: last, first, last, preventDefault: () => { prevented += 1; }, onEscape: () => { escaped += 1; } });
  handleModalKey({ key: "Tab", shiftKey: true, activeElement: first, first, last, preventDefault: () => { prevented += 1; }, onEscape: () => { escaped += 1; } });
  handleModalKey({ key: "Escape", shiftKey: false, activeElement: first, first, last, preventDefault: () => { prevented += 1; }, onEscape: () => { escaped += 1; } });
  assert.deepEqual(focused, ["first", "last"]);
  assert.equal(prevented, 3);
  assert.equal(escaped, 1);

  const removedInvoker = { isConnected: false, focus: () => focused.push("removed") };
  const stableFallback = { isConnected: true, focus: () => focused.push("fallback") };
  assert.equal(restoreModalFocus(removedInvoker, stableFallback), true);
  assert.equal(focused.at(-1), "fallback");
});

test("search ownership clears old suggestions and only the newest ticket may settle", async () => {
  const { createSearchOwnership } = await loadControllers();
  const owner = createSearchOwnership<string>();
  const first = owner.begin();
  owner.select("old");
  const second = owner.begin();
  assert.equal(owner.snapshot().selection, null);
  assert.equal(owner.snapshot().items.length, 0);
  assert.equal(owner.settle(first, { kind: "results", items: ["stale"] }), false);
  assert.equal(owner.settle(second, { kind: "results", items: ["current"] }), true);
  assert.deepEqual(owner.snapshot().items, ["current"]);
  owner.select("current");
  assert.deepEqual(owner.snapshot(), { ticket: 2, loading: false, items: [], selection: "current", error: null });
});

test("start is single-flight across repeated calls and allows retry only after a rejection", async () => {
  const { createStartGate } = await loadControllers();
  let calls = 0;
  let resolve!: (value: { state: "active" }) => void;
  const gate = createStartGate(() => {
    calls += 1;
    return new Promise<{ state: "active" }>(done => { resolve = done; });
  });
  const first = gate.start();
  const second = gate.start();
  assert.equal(first, second);
  assert.equal(calls, 1);
  resolve({ state: "active" });
  assert.deepEqual(await first, { state: "active" });
  assert.equal(await gate.start(), await first);

  let failures = 0;
  const retrying = createStartGate(async () => {
    failures += 1;
    if (failures === 1) throw new Error("offline");
    return { state: "active" as const };
  });
  await assert.rejects(retrying.start(), /offline/);
  assert.deepEqual(await retrying.start(), { state: "active" });
  assert.equal(failures, 2);
});

test("versioned setup recovery is 24-hour, fail-closed, storage-safe, and never restores an unsaved order", async () => {
  const { SETUP_DRAFT_KEY, createPersistedSetupDraft, loadSetupDraft, restoreSetupState, saveSetupDraft } = await loadRecovery();
  const { initialSetupState, setupReducer } = await loadSetup();
  const now = Date.UTC(2026, 7, 11, 12);
  let state = initialSetupState();
  state = setupReducer(state, { type: "select-equipment", equipment: "cargo_van" });
  state = setupReducer(state, { type: "change-equipment-field", field: "truckNumber", value: "V-7" });
  state = setupReducer(state, { type: "change-equipment-field", field: "odometer", value: "701" });
  state = setupReducer(state, { type: "validate-equipment" });
  state = setupReducer(state, { type: "add-stop", stop: { providerId: "osm:node:8", displayName: "Dock", address: "8 Main St", type: "delivery" } });
  state = setupReducer(state, { type: "begin-organize" });
  const saved = createPersistedSetupDraft(state, "driver-a@example.com", now);
  assert.deepEqual(saved.committedStops.map(stop => stop.providerId), ["osm:node:8"]);
  assert.equal("organizingStops" in saved, false);

  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); } };
  assert.equal(saveSetupDraft(storage, saved), true);
  assert.deepEqual(loadSetupDraft(storage, "driver-a@example.com", now), saved);
  assert.deepEqual(restoreSetupState(saved), {
    stage: "route-list",
    equipmentDraft: { type: "cargo_van", truckNumber: "V-7", odometer: "701", trailerType: "", trailerNumber: "" },
    equipmentErrors: {},
    validatedEquipment: { type: "cargo_van", truckNumber: "V-7", odometer: "701" },
    committedStops: [{ providerId: "osm:node:8", displayName: "Dock", address: "8 Main St", type: "delivery", order: 0 }],
    organizingStops: [],
    routeError: null,
  });
  assert.equal(loadSetupDraft(storage, "driver-a@example.com", now + 24 * 60 * 60 * 1000 + 1), null);
  memory.set(SETUP_DRAFT_KEY, "{bad json");
  assert.equal(loadSetupDraft(storage, "driver-a@example.com", now), null);
  assert.equal(loadSetupDraft({ getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); }, removeItem: () => { throw new Error("denied"); } }, "driver-a@example.com", now), null);

  const impossible = { ...saved, stage: "route-search", equipmentDraft: { ...saved.equipmentDraft, truckNumber: "VISIBLE-1", odometer: "100" }, validatedEquipment: { type: "cargo_van", truckNumber: "HIDDEN-2", odometer: "999" }, committedStops: [] };
  memory.set(SETUP_DRAFT_KEY, JSON.stringify(impossible));
  assert.equal(loadSetupDraft(storage, "driver-a@example.com", now), null);

  const tractorMismatch = { ...saved, stage: "route-search", equipmentDraft: { type: "tractor", truckNumber: "T-1", odometer: "100", trailerType: "reefer", trailerNumber: "VISIBLE" }, validatedEquipment: { type: "tractor", truckNumber: "T-1", odometer: "100", trailerType: "reefer", trailerNumber: "HIDDEN" }, committedStops: [] };
  memory.set(SETUP_DRAFT_KEY, JSON.stringify(tractorMismatch));
  assert.equal(loadSetupDraft(storage, "driver-a@example.com", now), null);

  memory.set(SETUP_DRAFT_KEY, JSON.stringify(saved));
  assert.equal(loadSetupDraft(storage, "driver-b@example.com", now), null, "Driver B must not restore Driver A's setup");
  assert.equal(memory.has(SETUP_DRAFT_KEY), false, "mismatched owner records fail closed and are removed");
  memory.set(SETUP_DRAFT_KEY, JSON.stringify({ ...saved, version: 2, ownerId: undefined }));
  assert.equal(loadSetupDraft(storage, "driver-a@example.com", now), null, "unscoped v2 records are not migrated across a driver boundary");
  assert.equal(memory.has(SETUP_DRAFT_KEY), false);
});

test("overlong equipment values return focused validation errors without throwing", async () => {
  const { initialSetupState, setupReducer, validateEquipmentDraft } = await loadSetup();
  let state = setupReducer(initialSetupState(), { type: "select-equipment", equipment: "tractor" });
  state = setupReducer(state, { type: "change-equipment-field", field: "truckNumber", value: "T".repeat(81) });
  state = setupReducer(state, { type: "change-equipment-field", field: "odometer", value: "9".repeat(100_000) });
  state = setupReducer(state, { type: "change-equipment-field", field: "trailerType", value: "reefer" });
  state = setupReducer(state, { type: "change-equipment-field", field: "trailerNumber", value: "R".repeat(81) });
  let result: ReturnType<typeof validateEquipmentDraft> | undefined;
  assert.doesNotThrow(() => { result = validateEquipmentDraft(state.equipmentDraft); });
  assert.equal(result?.ok, false);
  if (result?.ok === false) {
    assert.equal(result.focusField, "truckNumber");
    assert.deepEqual(Object.keys(result.errors), ["truckNumber", "odometer", "trailerNumber"]);
  }
});

test("server authority clears drafts while exact completed dismissal yields to a new setup", async () => {
  const { resolveSetupAuthority } = await loadRecovery();
  const draft = { version: 3 as const, ownerId: "driver@example.com", savedAt: 10, stage: "equipment-info" as const, equipmentDraft: { type: "cargo_van" as const, truckNumber: "V-1", odometer: "20", trailerType: "" as const, trailerNumber: "" }, validatedEquipment: null, committedStops: [] };
  assert.deepEqual(resolveSetupAuthority({ server: { id: "active-1", state: "active" }, draft, dismissedCompletedId: null }), { source: "server", aggregate: { id: "active-1", state: "active" }, clearDraft: true });
  assert.deepEqual(resolveSetupAuthority({ server: { id: "done-1", state: "completed" }, draft, dismissedCompletedId: null }), { source: "server", aggregate: { id: "done-1", state: "completed" }, clearDraft: true });
  assert.deepEqual(resolveSetupAuthority({ server: { id: "done-1", state: "completed" }, draft, dismissedCompletedId: "done-1" }), { source: "draft", draft, clearDraft: false });
  assert.deepEqual(resolveSetupAuthority({ server: { id: "done-2", state: "completed" }, draft, dismissedCompletedId: "done-1" }), { source: "server", aggregate: { id: "done-2", state: "completed" }, clearDraft: true });
});

test("the root exposes only the v2 app, accessible support/auth flows, exact route stages, and the PWA manifest", async () => {
  const [page, app, shell, settings, home, equipment, route, layout, manifest] = await Promise.all([
    readFile(resolve(projectRoot, "app/page.tsx"), "utf8"),
    readFile(resolve(projectRoot, "app/v2/StopScoreV2App.tsx"), "utf8"),
    readFile(resolve(projectRoot, "app/v2/components/AppShell.tsx"), "utf8"),
    readFile(resolve(projectRoot, "app/v2/components/SettingsPanel.tsx"), "utf8"),
    readFile(resolve(projectRoot, "app/v2/components/Home.tsx"), "utf8"),
    readFile(resolve(projectRoot, "app/v2/components/EquipmentFlow.tsx"), "utf8"),
    readFile(resolve(projectRoot, "app/v2/components/RouteFlow.tsx"), "utf8"),
    readFile(resolve(projectRoot, "app/layout.tsx"), "utf8"),
    readFile(resolve(projectRoot, "app/manifest.ts"), "utf8"),
  ]);
  assert.match(page, /^import StopScoreV2App/m);
  assert.match(page, /return <StopScoreV2App \/>/);
  assert.doesNotMatch(page, /prototype|legacy|Screen\s*=|useState/);
  assert.match(app, /\/api\/session/);
  assert.match(app, /signin-with-chatgpt\?return_to=%2F/);
  assert.match(app, /role="dialog"/);
  assert.match(home, /Start My Day/);
  assert.match(shell, /aria-label="Settings and theme"/);
  assert.match(shell, /@phosphor-icons\/react/);
  assert.match(shell, /<GearSix aria-hidden="true"/);
  assert.match(settings, /Light/);
  assert.match(settings, /Dark/);
  assert.match(settings, /Saved Stops and Routes/);
  assert.match(equipment, /Truck #/);
  assert.match(equipment, /TRL # \(Optional\)/);
  for (const stage of ["Search", "Stop Type", "Route List", "Organize", "Prepare"]) assert.match(route, new RegExp(stage));
  assert.match(route, /aria-describedby/);
  assert.match(route, /onKeyDown/);
  assert.match(route, /Escape/);
  assert.match(route, /setPointerCapture/);
  assert.match(layout, /manifest:\s*["']\/manifest\.webmanifest["']/);
  assert.match(manifest, /name:\s*["']StopScore Driver OS["']/);
});

test("workspace sizing never constrains a modal backdrop to the centered content column", async () => {
  const styles = await readFile(resolve(projectRoot, "app/v2/styles.css"), "utf8");
  assert.match(styles, /\.v2-workspace\s*>\s*:not\(\.v2-modal-backdrop\)\s*\{/);
  assert.doesNotMatch(styles, /\.v2-workspace\s*>\s*\*\s*\{/);
});
