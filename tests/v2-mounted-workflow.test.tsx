import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { WorkMode } from "../app/v2/components/WorkMode.tsx";
import { ExperienceFlow } from "../app/v2/components/ExperienceFlow.tsx";
import { FinishDay } from "../app/v2/components/FinishDay.tsx";
import { WorkflowStatus } from "../app/v2/components/WorkflowStatus.tsx";
import { RouteFlow } from "../app/v2/components/RouteFlow.tsx";
import { loadExperienceRecovery } from "../app/v2/workflow/experience-recovery.ts";
import type { WorkdayAggregate } from "../app/v2/domain/workday.ts";
import { initialSetupState, setupReducer, type SetupState } from "../app/v2/setup/model.ts";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const stop = { id: "stop-1", providerId: "osm:node:1", displayName: "North Dock", address: " 10  Main St ", type: "delivery" as const, order: 0, state: "pending" as const };
const workday = (state: WorkdayAggregate["state"] = "active", stopState: WorkdayAggregate["stops"][number]["state"] = "pending", activeStopIndex = 0): WorkdayAggregate => ({
  id: "day-1", state, activeStopIndex, equipment: { type: "cargo_van", truckNumber: "V-1", odometer: "10" }, stops: [{ ...stop, state: stopState }],
});

function memoryStorage() {
  const memory = new Map<string, string>();
  return { memory, storage: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); }, clear: () => memory.clear(), key: () => null, get length() { return memory.size; } } as Storage };
}

test("mounted Work Mode executes its one legal action, external navigation, and copy fallback", async () => {
  const opened: string[] = [];
  const copied: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: { open: (href: string) => opened.push(href) } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (value: string) => { copied.push(value); } } } });
  const events: Array<[string, string]> = [];
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<WorkMode workday={workday()} onEvent={async (stopId, action) => { events.push([stopId, action]); return workday("active", "navigating"); }} />); });
  const primary = renderer.root.findAll(node => node.type === "button" && String(node.props.className).includes("v2-primary-button"));
  assert.equal(primary.length, 1);
  assert.equal(primary[0].children[0], "Navigate");
  await act(async () => { await primary[0].props.onClick(); });
  for (const [state, label] of [["navigating", "Arrive"], ["arrived", "Depart"]] as const) {
    await act(async () => { renderer.update(<WorkMode workday={workday("active", state)} onEvent={async (stopId, action) => { events.push([stopId, action]); return workday(); }} />); });
    const action = renderer.root.findAll(node => node.type === "button" && String(node.props.className).includes("v2-primary-button"));
    assert.equal(action.length, 1); assert.equal(action[0].children[0], label);
    await act(async () => { await action[0].props.onClick(); });
  }
  assert.deepEqual(events, [["stop-1", "navigate"], ["stop-1", "arrive"], ["stop-1", "depart"]]);
  assert.deepEqual(opened, ["https://www.google.com/maps/search/?api=1&query=10%20Main%20St"]);
  const copy = renderer.root.find(node => node.type === "button" && node.children.includes("Copy address"));
  await act(async () => { await copy.props.onClick(); });
  assert.deepEqual(copied, ["10 Main St"]);
});

test("mounted Stop Knowledge auto-advances and never exposes publish before completion", async () => {
  const { storage } = memoryStorage();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<ExperienceFlow workdayId="day-invalid" stop={{ ...stop, state: "departed" }} onPublish={async () => workday()} />, { createNodeMock: () => ({ focus() {} }) }); });
  assert.equal(renderer.root.findAll(node => node.type === "button" && String(node.children[0]).includes("Publish Experience")).length, 0);
  const yard = renderer.root.find(node => node.type === "input" && node.props.name === "yard" && node.props.value === 4);
  await act(async () => { yard.props.onChange(); });
  assert.equal(renderer.root.findByType("h1").children[0], "Staging");
});

test("mounted Stop Knowledge rejects malformed scored recovery and performs no publish write", async () => {
  const { memory, storage } = memoryStorage();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });
  memory.set("stopscore:v2:experience:day-malformed:stop-1", JSON.stringify({
    version: 1,
    workdayId: "day-malformed",
    stopId: "stop-1",
    savedAt: Date.now(),
    idempotencyKey: "malformed-key",
    draft: { stopId: "stop-1", scores: { yard: 4, staging: 3, staff: 5, waitingTime: 2, bathroomAccess: 4 }, waitingCategory: "standard", bathroomAnswer: null, bathroomCondition: null },
  }));
  let publishCalls = 0;
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<ExperienceFlow workdayId="day-malformed" stop={{ ...stop, state: "departed" }} onPublish={async () => { publishCalls += 1; return workday("active", "experience_published", 1); }} />, { createNodeMock: () => ({ focus() {} }) }); });
  assert.equal(publishCalls, 0);
  assert.equal(renderer.root.findByType("h1").children[0], "Yard Experience");
  assert.equal(renderer.root.findAll(node => node.type === "button" && String(node.children[0]).includes("Publish Experience")).length, 0);
});

test("mounted Stop Knowledge preserves answers and key through sign-in navigation/remount, then clears only on success", async () => {
  const { memory, storage } = memoryStorage();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });
  const publishedKeys: string[] = [];
  let attempts = 0;
  const publish = async (_stopId: string, _input: unknown, key: string) => {
    publishedKeys.push(key); attempts += 1;
    if (attempts === 1) throw new Error("Sign in to use your workday.");
    return workday("active", "experience_published", 1);
  };

  const mount = async () => {
    let instance!: TestRenderer.ReactTestRenderer;
    await act(async () => { instance = TestRenderer.create(<ExperienceFlow workdayId="day-1" stop={{ ...stop, state: "departed" }} onPublish={publish} />, { createNodeMock: () => ({ focus() {} }) }); });
    return instance;
  };
  const chooseScore = async (renderer: TestRenderer.ReactTestRenderer, name: string, value: number) => {
    const input = renderer.root.find(node => node.type === "input" && node.props.name === name && node.props.value === value);
    await act(async () => { input.props.onChange(); });
  };
  const complete = async (renderer: TestRenderer.ReactTestRenderer) => {
    await chooseScore(renderer, "yard", 4);
    await chooseScore(renderer, "staging", 3);
    await chooseScore(renderer, "staff", 5);
    const waiting = renderer.root.findAll(node => node.type === "input" && node.props.name === "waiting-category")[0];
    await act(async () => { waiting.props.onChange(); });
    const no = renderer.root.find(node => node.type === "input" && node.props.name === "bathroom-answer" && Boolean(node.parent?.findAll(child => child.type === "span" && child.children.includes("No")).length));
    await act(async () => { no.props.onChange(); });
  };

  let renderer = await mount();
  await complete(renderer);
  const publishButton = renderer.root.find(node => node.type === "button" && String(node.children[0]).includes("Publish Experience"));
  await act(async () => { await publishButton.props.onClick(); });
  assert.equal(renderer.root.findAll(node => node.type === "a" && node.children.includes("Sign in again")).length, 1);
  const recovered = loadExperienceRecovery(storage, "day-1", "stop-1");
  assert.ok(recovered);
  assert.equal(recovered.draft.scores.yard, 4);
  assert.equal(recovered.draft.bathroomAnswer, "no");
  const originalKey = recovered.idempotencyKey;
  await act(async () => { renderer.unmount(); });

  renderer = await mount();
  await complete(renderer);
  const retry = renderer.root.find(node => node.type === "button" && String(node.children[0]).includes("Publish Experience"));
  await act(async () => { await retry.props.onClick(); });
  assert.deepEqual(publishedKeys, [originalKey, originalKey]);
  assert.equal(memory.size, 0);
});

test("mounted workflow status transfers focus and announces state, and Finish Day retains completed summary", async () => {
  const focused: string[] = [];
  Object.defineProperty(globalThis, "document", { configurable: true, value: { getElementById: (id: string) => ({ focus: () => focused.push(id) }) } });
  Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: (callback: () => void) => { callback(); return 1; } });
  Object.defineProperty(globalThis, "cancelAnimationFrame", { configurable: true, value: () => undefined });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<WorkflowStatus workday={workday()} />); });
  assert.equal(renderer.root.findByType("p").children[0], "Stop 1 of 1. North Dock. Navigate.");
  await act(async () => { renderer.update(<WorkflowStatus workday={workday("active", "departed")} />); });
  assert.equal(renderer.root.findByType("p").children[0], "Stop Knowledge for North Dock.");
  await act(async () => { renderer.update(<WorkflowStatus workday={workday("completed", "experience_published", 1)} />); });
  assert.equal(renderer.root.findByType("p").children[0], "Workday complete. 1 stop finished.");
  assert.deepEqual(focused, ["workmode-stop-1-action", "experience-stop-1-yard", "finish-day-title"]);

  let dismissed = 0;
  let finishCalls = 0;
  await act(async () => { renderer.update(<FinishDay workday={workday("active", "experience_published", 1)} onFinish={async () => { finishCalls += 1; return workday("completed", "experience_published", 1); }} onDismiss={() => undefined} />); });
  const continueToSummary = renderer.root.find(node => node.type === "button" && node.children.includes("Continue to Day Summary"));
  await act(async () => { continueToSummary.props.onClick(); });
  const finish = renderer.root.find(node => node.type === "button" && node.children.includes("Finish Day"));
  await act(async () => { await finish.props.onClick(); });
  assert.equal(finishCalls, 1);
  await act(async () => { renderer.update(<FinishDay workday={workday("completed", "experience_published", 1)} onFinish={async () => workday("completed", "experience_published", 1)} onDismiss={() => { dismissed += 1; }} />); });
  assert.equal(renderer.root.findByProps({ id: "finish-day-title" }).children[0], "Today’s Summary");
  const dismiss = renderer.root.find(node => node.type === "button" && node.children.includes("Close Summary"));
  await act(async () => { dismiss.props.onClick(); });
  assert.equal(dismissed, 1);
});

test("mounted setup wipes visible state across sign-out and never restores Driver A's draft for Driver B", async () => {
  const { memory, storage } = memoryStorage();
  memory.set("stopscore-v2-setup-draft", JSON.stringify({
    version: 3, ownerId: "driver-a@example.com", savedAt: Date.now(), stage: "route-list",
    equipmentDraft: { type: "cargo_van", truckNumber: "A-PRIVATE-TRUCK", odometer: "10", trailerType: "", trailerNumber: "" },
    validatedEquipment: { type: "cargo_van", truckNumber: "A-PRIVATE-TRUCK", odometer: "10" },
    committedStops: [{ providerId: "osm:node:88", displayName: "A Private Dock", address: "100 Private Dock Rd", type: "delivery", order: 0 }],
  }));
  const timers: Array<() => void> = [];
  const documentMock = { currentScript: { dataset: {} }, documentElement: { dataset: {}, style: {} }, querySelector: () => null, addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, "document", { configurable: true, value: documentMock });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage, setTimeout: (callback: () => void) => { timers.push(callback); return timers.length; }, clearTimeout() {} } });
  Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: (callback: () => void) => { callback(); return 1; } });
  Object.defineProperty(globalThis, "cancelAnimationFrame", { configurable: true, value: () => undefined });
  const { StopScoreWorkspace } = await import("../app/v2/StopScoreV2App.tsx");
  const client = (session: unknown) => ({ session, workday: null, loadingWorkday: false, refresh: async () => {}, start: async () => { throw new Error("must not start"); }, recordEvent: async () => { throw new Error("unused"); }, publishExperience: async () => { throw new Error("unused"); }, finishWorkday: async () => { throw new Error("unused"); } });
  const flushTimers = async () => { await act(async () => { for (const callback of timers.splice(0)) callback(); }); };
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<StopScoreWorkspace client={client({ status: "authenticated", user: { displayName: "Driver A", email: "driver-a@example.com" } }) as never} />); });
  await flushTimers();
  assert.equal(renderer.root.findAll(node => node.children.includes("A Private Dock")).length > 0, true);

  await act(async () => { renderer.update(<StopScoreWorkspace client={client({ status: "authenticated", user: { displayName: "Driver B", email: "driver-b@example.com" } }) as never} />); });
  assert.equal(JSON.parse(memory.get("stopscore-v2-setup-draft") ?? "null")?.ownerId, "driver-a@example.com", "a direct identity transition must not rebind A's in-memory setup to B");
  await flushTimers();
  assert.equal(renderer.root.findAll(node => node.children.includes("A Private Dock") || node.children.includes("A-PRIVATE-TRUCK")).length, 0);

  memory.set("stopscore-v2-setup-draft", JSON.stringify({ version: 3, ownerId: "driver-a@example.com", savedAt: Date.now(), stage: "equipment-info", equipmentDraft: { type: "cargo_van", truckNumber: "A-PRIVATE-TRUCK", odometer: "10", trailerType: "", trailerNumber: "" }, validatedEquipment: null, committedStops: [] }));

  await act(async () => { renderer.update(<StopScoreWorkspace client={client({ status: "unauthenticated" }) as never} />); });
  await flushTimers();
  assert.equal(renderer.root.findAll(node => node.children.includes("A Private Dock")).length, 0);
  await act(async () => { renderer.update(<StopScoreWorkspace client={client({ status: "authenticated", user: { displayName: "Driver B", email: "driver-b@example.com" } }) as never} />); });
  assert.equal(JSON.parse(memory.get("stopscore-v2-setup-draft") ?? "null")?.ownerId, "driver-a@example.com", "A's in-memory setup must not be rebound to B before authority resolves");
  await flushTimers();
  assert.equal(renderer.root.findAll(node => node.children.includes("A Private Dock") || node.children.includes("A-PRIVATE-TRUCK")).length, 0);
  assert.equal(renderer.root.findAll(node => node.type === "button" && node.findAll(child => child.type === "span" && child.children.includes("Start My Day")).length > 0).length, 1);
  assert.equal(memory.has("stopscore-v2-setup-draft"), false);
});

test("mounted route stages focus and announce each replacement screen deterministically", async () => {
  const focused: string[] = [];
  Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: (callback: () => void) => { callback(); return 1; } });
  const routeList: SetupState = {
    ...initialSetupState(), stage: "route-list",
    equipmentDraft: { type: "cargo_van", truckNumber: "V-1", odometer: "10", trailerType: "", trailerNumber: "" },
    validatedEquipment: { type: "cargo_van", truckNumber: "V-1", odometer: "10" },
    committedStops: [
      { providerId: "osm:node:1", displayName: "North", address: "1 Main St", type: "delivery", order: 0 },
      { providerId: "osm:node:2", displayName: "South", address: "2 Main St", type: "pickup", order: 1 },
    ],
  };
  function Harness() {
    const [state, setState] = React.useState(routeList);
    return <RouteFlow state={state} dispatch={action => setState(current => setupReducer(current, action))} onPrepare={async () => workday()} />;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<Harness />, { createNodeMock: element => ({ isConnected: true, focus: () => focused.push(String((element.props as { id?: unknown }).id ?? "unknown")) }) }); });
  const click = async (label: string) => {
    const button = renderer.root.find(node => node.type === "button" && node.children.some(child => child === label));
    await act(async () => { button.props.onClick(); });
  };
  await click("Organize");
  await click("Back");
  await click("Prepare My Route ");
  const returnToRouteList = renderer.root.findByProps({ "aria-label": "Return to Route List" });
  await act(async () => { returnToRouteList.props.onClick(); });
  assert.deepEqual(focused.slice(-5), ["route-route-list-title", "route-organize-title", "route-route-list-title", "route-prepare-title", "route-route-list-title"]);
  const status = renderer.root.findByProps({ "aria-live": "polite" });
  assert.match(String(status.children[0]), /Route List/i);
});

test("route address suggestions appear after typing and disappear after selection", async () => {
  Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: (callback: () => void) => { callback(); return 1; } });
  const requests: string[] = [];
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: async (input: string) => {
    requests.push(input);
    return new Response(JSON.stringify({ kind: "results", suggestions: [{ providerId: "osm:node:91", displayName: "Metro Distribution Center", address: "1500 Distribution Way, Memphis, TN 38118" }, { providerId: "osm:node:92", displayName: "Metro Overflow Yard", address: "1502 Distribution Way, Memphis, TN 38118" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  } });
  const routeSearch: SetupState = {
    ...initialSetupState(), stage: "route-search",
    equipmentDraft: { type: "small_box_truck", truckNumber: "SB-1", odometer: "10", trailerType: "", trailerNumber: "" },
    validatedEquipment: { type: "small_box_truck", truckNumber: "SB-1", odometer: "10" },
  };
  function Harness() {
    const [state, setState] = React.useState(routeSearch);
    return <RouteFlow state={state} dispatch={action => setState(current => setupReducer(current, action))} onPrepare={async () => workday()} />;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<Harness />, { createNodeMock: () => ({ isConnected: true, focus() {} }) }); });
  const input = renderer.root.findByProps({ id: "place-query" });
  await act(async () => { input.props.onChange({ target: { value: "1500 Distribution" } }); });
  assert.equal(requests.length, 0);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 330)); });
  assert.equal(requests.length, 1);
  assert.match(requests[0], /1500%20Distribution/);
  const readyInput = renderer.root.findByProps({ id: "place-query" });
  assert.equal(readyInput.props["aria-activedescendant"], undefined);
  await act(async () => { readyInput.props.onKeyDown({ key: "ArrowUp", preventDefault() {} }); });
  assert.equal(renderer.root.findByProps({ id: "place-query" }).props["aria-activedescendant"], "place-suggestion-1");
  const wrappedInput = renderer.root.findByProps({ id: "place-query" });
  await act(async () => { wrappedInput.props.onKeyDown({ key: "ArrowDown", preventDefault() {} }); });
  assert.equal(renderer.root.findByProps({ id: "place-query" }).props["aria-activedescendant"], "place-suggestion-0");
  const suggestion = renderer.root.find(node => node.type === "button" && node.children.some(child => typeof child !== "string" && child.props?.children === "Metro Distribution Center"));
  await act(async () => { suggestion.props.onClick(); });
  assert.equal(renderer.root.findAllByProps({ id: "place-suggestions" }).length, 0);
  assert.equal(renderer.root.findByType("h1").children[0], "Choose Stop Type");
  assert.equal(renderer.root.findAll(node => node.children.includes("1500 Distribution Way, Memphis, TN 38118")).length > 0, true);
  const backToSearch = renderer.root.find(node => node.type === "button" && String(node.props.className).includes("v2-back-link"));
  await act(async () => { backToSearch.props.onClick(); await new Promise(resolve => setTimeout(resolve, 330)); });
  assert.equal(requests.length, 1, "returning with the selected address must not reopen suggestions");
});

test("theme menu controller focuses selection, supports arrows, and restores its trigger on Escape and selection", async () => {
  const { focusMenuSelection, handleMenuKey, restoreModalFocus } = await import("../app/v2/setup/controllers.ts");
  const focused: string[] = [];
  const targets = ["Light", "Dark"].map(label => ({ isConnected: true, focus: () => focused.push(label) }));
  const trigger = { isConnected: true, focus: () => focused.push("trigger") };
  assert.equal(focusMenuSelection(targets, 1), true);
  let prevented = 0;
  let closed = 0;
  handleMenuKey({ key: "ArrowUp", currentIndex: 1, itemCount: 2, focusIndex: index => targets[index].focus(), preventDefault: () => { prevented += 1; }, closeAndRestore: () => { closed += 1; restoreModalFocus(trigger, null); } });
  handleMenuKey({ key: "Escape", currentIndex: 0, itemCount: 2, focusIndex: index => targets[index].focus(), preventDefault: () => { prevented += 1; }, closeAndRestore: () => { closed += 1; restoreModalFocus(trigger, null); } });
  assert.deepEqual(focused, ["Dark", "Light", "trigger"]);
  assert.equal(prevented, 2);
  assert.equal(closed, 1);
});
