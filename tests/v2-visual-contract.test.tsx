import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ExperienceFlow } from "../app/v2/components/ExperienceFlow.tsx";
import { EquipmentFlow } from "../app/v2/components/EquipmentFlow.tsx";
import { FinishDay } from "../app/v2/components/FinishDay.tsx";
import { Home } from "../app/v2/components/Home.tsx";
import { RouteFlow } from "../app/v2/components/RouteFlow.tsx";
import { WorkMode } from "../app/v2/components/WorkMode.tsx";
import type { WorkdayAggregate } from "../app/v2/domain/workday.ts";
import { initialSetupState, setupReducer } from "../app/v2/setup/model.ts";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as typeof globalThis & { requestAnimationFrame: (callback: FrameRequestCallback) => number }).requestAnimationFrame = callback => { callback(0); return 1; };
(globalThis as typeof globalThis & { cancelAnimationFrame: (id: number) => void }).cancelAnimationFrame = () => undefined;

const session = {
  status: "authenticated" as const,
  user: { displayName: "Jose", email: "jose@example.com" },
};

const stops = [
  { id: "stop-1", providerId: "osm:node:1", displayName: "Metro Distribution Center", address: "1500 Distribution Way, Memphis, TN 38118", type: "delivery" as const, order: 0, state: "pending" as const },
  { id: "stop-2", providerId: "osm:node:2", displayName: "Southgate Retail", address: "4200 Southgate Dr, Jackson, MS 39201", type: "pickup" as const, order: 1, state: "pending" as const },
];

const workday: WorkdayAggregate = {
  id: "day-1",
  state: "active",
  activeStopIndex: 0,
  equipment: { type: "tractor", truckNumber: "7821", trailerType: "dry_van", trailerNumber: "V45678", odometer: "456789" },
  stops,
};

function memoryStorage(): Storage {
  const memory = new Map<string, string>();
  return {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, value); },
    removeItem: key => { memory.delete(key); },
    clear: () => memory.clear(),
    key: index => [...memory.keys()][index] ?? null,
    get length() { return memory.size; },
  };
}

function visibleText(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll(() => true).flatMap(node => node.children.filter((child): child is string => typeof child === "string")).join(" ").replace(/\s+/g, " ").replace(/\s+([,.?])/g, "$1");
}

test("equipment selection confirms one real vehicle before advancing to details", async () => {
  let focusedClassName = "";
  function EquipmentHarness() {
    const [state, dispatch] = React.useReducer(setupReducer, undefined, initialSetupState);
    return <EquipmentFlow state={state} dispatch={dispatch} />;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<EquipmentHarness />, {
      createNodeMock: element => ({
        focus() {
          const props = element.props as Record<string, unknown>;
          focusedClassName = element.type === "input" ? "truck-number" : String(props.className ?? "");
        },
      }),
    });
  });

  assert.equal(renderer.root.findAll(node => node.type === "button" && node.props.disabled === true && node.children.includes("Equipment")).length, 0);
  const cards = renderer.root.findAll(node => node.type === "button" && String(node.props.className).includes("v2-equipment-card"));
  assert.deepEqual(cards.map(card => card.findByType("strong").children[0]), ["Truck Tractor", "Truck Bobtail", "Box Truck", "Small Box Truck", "Cargo Van"]);
  assert.equal(cards.every(card => card.props["aria-pressed"] === false), true);
  const continueButton = renderer.root.find(node => node.type === "button" && String(node.props.className).includes("v2-equipment-continue"));
  assert.equal(continueButton.props.disabled, true);

  const smallBoxTruck = cards.find(card => card.findByType("strong").children[0] === "Small Box Truck");
  assert.ok(smallBoxTruck);
  await act(async () => { smallBoxTruck.props.onClick(); });
  const selected = renderer.root.findAll(node => node.type === "button" && node.props["aria-pressed"] === true);
  assert.equal(selected.length, 1);
  assert.match(visibleText(renderer), /Small Box Truck/);
  assert.match(visibleText(renderer), /Choose Your Equipment/);

  const enabledContinue = renderer.root.find(node => node.type === "button" && String(node.props.className).includes("v2-equipment-continue"));
  assert.equal(enabledContinue.props.disabled, false);
  await act(async () => { enabledContinue.props.onClick(); });
  assert.match(visibleText(renderer), /Equipment Information/);
  assert.equal(focusedClassName, "truck-number");

  const changeEquipment = renderer.root.find(node => node.type === "button" && String(node.props.className).includes("v2-back-link"));
  await act(async () => { changeEquipment.props.onClick(); });
  assert.match(visibleText(renderer), /Choose Your Equipment/);
  const restored = renderer.root.findAll(node => node.type === "button" && node.props["aria-pressed"] === true);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].findByType("strong").children[0], "Small Box Truck");
  assert.match(focusedClassName, /v2-equipment-card selected/);
});

test("Truck Tractor opens a horizontally scrollable complete trailer screen before Equipment Information", async () => {
  function EquipmentHarness() {
    const [state, dispatch] = React.useReducer(setupReducer, undefined, initialSetupState);
    return <EquipmentFlow state={state} dispatch={dispatch} />;
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<EquipmentHarness />, { createNodeMock: () => ({ focus() {} }) });
  });

  const cards = renderer.root.findAll(node => node.type === "button" && String(node.props.className).includes("v2-equipment-card"));
  assert.deepEqual(cards.map(card => card.findByType("strong").children[0]), ["Truck Tractor", "Truck Bobtail", "Box Truck", "Small Box Truck", "Cargo Van"]);
  await act(async () => { cards[0].props.onClick(); });
  assert.doesNotMatch(visibleText(renderer), /Choose your trailer/);
  await act(async () => { renderer.root.find(node => node.type === "button" && String(node.props.className).includes("v2-equipment-continue")).props.onClick(); });

  assert.match(visibleText(renderer), /Select Trailer Type/);
  assert.match(visibleText(renderer), /Swipe to see all trailer types/);
  const trailerChoices = renderer.root.findAll(node => node.type === "button" && String(node.props.className).includes("v2-trailer-option"));
  assert.deepEqual(trailerChoices.map(choice => choice.findByType("span").children[0]), ["Dry Van", "Reefer", "Flatbed", "Step Deck", "Tanker", "Other"]);
  assert.equal(trailerChoices.every(choice => choice.props["aria-pressed"] === false), true);
  assert.equal(renderer.root.find(node => node.type === "button" && String(node.props.className).includes("v2-trailer-continue")).props.disabled, true);

  await act(async () => { trailerChoices[0].props.onClick(); });
  assert.equal(renderer.root.find(node => node.type === "button" && String(node.props.className).includes("v2-trailer-continue")).props.disabled, false);
  await act(async () => { renderer.root.find(node => node.type === "button" && String(node.props.className).includes("v2-trailer-continue")).props.onClick(); });

  assert.match(visibleText(renderer), /Equipment Information/);
  assert.match(visibleText(renderer), /Trailer Type Dry Van/);
  assert.match(visibleText(renderer), /TRL # \(Optional\)/);
  assert.equal(renderer.root.findAll(node => node.type === "select").length, 0, "Trailer Type must not be asked twice");

  await act(async () => { renderer.root.find(node => node.type === "button" && String(node.props.className).includes("v2-back-link")).props.onClick(); });
  assert.equal(renderer.root.find(node => node.type === "button" && String(node.props.className).includes("v2-equipment-card") && node.props["aria-pressed"] === true).findByType("strong").children[0], "Truck Tractor");

  const bobtail = renderer.root.findAll(node => node.type === "button" && String(node.props.className).includes("v2-equipment-card")).find(card => card.findByType("strong").children[0] === "Truck Bobtail");
  assert.ok(bobtail);
  await act(async () => { bobtail.props.onClick(); });
  assert.equal(renderer.root.findAll(node => String(node.props.className).includes("v2-trailer-options")).length, 0);
  assert.equal(renderer.root.find(node => node.type === "button" && String(node.props.className).includes("v2-equipment-continue")).props.disabled, false);
  await act(async () => { renderer.root.find(node => node.type === "button" && String(node.props.className).includes("v2-equipment-continue")).props.onClick(); });
  assert.match(visibleText(renderer), /Equipment Information/);
});

test("approved equipment information confirms Equipment Ready before route building", async () => {
  let state = initialSetupState();
  state = setupReducer(state, { type: "select-equipment", equipment: "tractor" });
  state = setupReducer(state, { type: "select-trailer", trailerType: "dry_van" });
  state = setupReducer(state, { type: "change-equipment-field", field: "truckNumber", value: "124" });
  state = setupReducer(state, { type: "change-equipment-field", field: "odometer", value: "125560" });
  state = setupReducer(state, { type: "change-equipment-field", field: "trailerNumber", value: "48219" });
  state = setupReducer(state, { type: "validate-equipment" });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<EquipmentFlow state={state} dispatch={() => undefined} />); });
  const text = visibleText(renderer);
  assert.match(text, /Equipment Ready/);
  assert.match(text, /Your equipment is set and ready to go\./);
  assert.match(text, /Truck # 124/);
  assert.match(text, /Trailer Type Dry Van/);
  assert.match(text, /TRL # \(Optional\) 48219/);
  assert.match(text, /Starting Odometer 125560 MI/);
  assert.match(text, /Build Today’s Route/);
});

test("approved header and Home expose the cinematic wordmark, named greeting, date, honest utilities, and safety message", async () => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: memoryStorage() } });
  const shellSource = await readFile(new URL("../app/v2/components/AppShell.tsx", import.meta.url), "utf8");
  assert.match(shellSource, /aria-label="Language: English \(United States\)"/);
  assert.match(shellSource, /us-language-reference\.png/);
  assert.match(shellSource, /v2-brand-lockup/);
  assert.match(shellSource, /stopscore-logo-header\.png/);
  assert.doesNotMatch(shellSource, /<span className="v2-brand-stop">STOP<\/span><span className="v2-brand-score">SCORE<\/span>/);

  let home!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    home = TestRenderer.create(<Home session={session} onStart={() => undefined} onRetrySession={() => undefined} />);
  });
  const text = visibleText(home);
  assert.match(text, /Good (morning|afternoon|evening), Jose/);
  assert.match(text, /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),? [A-Z][a-z]+ \d{1,2}/);
  assert.match(text, /Check Weather/);
  assert.match(text, /View Traffic/);
  assert.doesNotMatch(text, /68° F|Partly Cloudy|Light/);
  assert.match(text, /StopScore is not a GPS\./);
  const homeWordmark = home.root.findAll(node => node.type === "img" && String(node.props.className).includes("v2-home-logo") && node.props.alt === "StopScore");
  assert.equal(homeWordmark.length, 1, "Home must show the approved horizontal StopScore wordmark once");
  assert.equal(home.root.findAll(node => String(node.props.className).includes("v2-home-backdrop") && String(node.props.style?.backgroundImage).includes("stopscore-road-")).length, 1);
  assert.equal(home.root.findAll(node => node.type === "button" && String(node.props.className).includes("v2-home-action") && node.findAll(child => child.type === "svg").length > 0).length, 0);
  assert.equal(home.root.findAll(node => node.type === "svg" && String(node.props.className).includes("v2-home-utility-icon")).length, 2);
});

test("approved Work Mode presents street progress, equipment, current and next stops, one legal action, and honest Stop Knowledge", async () => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { open: () => undefined } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async () => undefined } } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<WorkMode workday={workday} onEvent={async () => workday} />);
  });
  const text = visibleText(renderer);
  assert.match(text, /Stop\s+1\s+of\s+2/);
  assert.match(text, /Truck # 7821 · Dry Van · TRL # V45678/);
  assert.match(text, /Metro Distribution Center/);
  assert.match(text, /Next Stop/);
  assert.match(text, /Southgate Retail/);
  assert.match(text, /Stop Knowledge/);
  assert.doesNotMatch(text, /Open 7:00 AM|Close 5:00 PM/);
  assert.equal(renderer.root.findAll(node => node.type === "button" && String(node.props.className).includes("v2-work-action")).length, 1);
  assert.equal(renderer.root.findAll(node => node.type === "button" && node.props.disabled === true).length, 0, "Work Mode must not show disabled false affordances");
  assert.equal(renderer.root.findAll(node => String(node.props.className).includes("v2-progress-marker")).length, 2);
  const knowledge = renderer.root.find(node => node.type === "button" && String(node.props.className).includes("v2-knowledge-row"));
  await act(async () => { knowledge.props.onClick(); });
  assert.match(visibleText(renderer), /Stop Knowledge/);
  assert.match(visibleText(renderer), /No shared experience has been published for this stop yet\./);
  for (const topic of ["Yard Experience", "Staging", "Staff Experience", "Waiting Time", "Bathroom Access"]) assert.match(visibleText(renderer), new RegExp(topic));
  assert.equal(renderer.root.findAll(node => node.props.role === "dialog").length, 1);
});

test("route list contains only route actions and truthful organize instructions", async () => {
  let state = initialSetupState();
  state = setupReducer(state, { type: "select-equipment", equipment: "cargo_van" });
  state = setupReducer(state, { type: "change-equipment-field", field: "truckNumber", value: "V-7" });
  state = setupReducer(state, { type: "change-equipment-field", field: "odometer", value: "900" });
  state = setupReducer(state, { type: "validate-equipment" });
  state = setupReducer(state, { type: "add-stop", stop: { providerId: "osm:node:1", displayName: "North Dock", address: "100 Main St", type: "delivery" } });
  state = setupReducer(state, { type: "add-stop", stop: { providerId: "osm:node:2", displayName: "South Dock", address: "200 Main St", type: "pickup" } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<RouteFlow state={state} dispatch={() => undefined} onPrepare={async () => workday} />, { createNodeMock: () => ({ focus() {} }) }); });
  assert.doesNotMatch(visibleText(renderer), /Mark ready locally|Clear local ready|Ready locally/);
  const routeButtons = renderer.root.findAll(node => node.type === "button").map(node => visibleText({ root: node } as never));
  assert.equal(routeButtons.some(label => /Mark ready locally|Clear local ready/.test(label)), false);

  state = setupReducer(state, { type: "begin-organize" });
  await act(async () => { renderer.update(<RouteFlow state={state} dispatch={() => undefined} onPrepare={async () => workday} />); });
  assert.match(visibleText(renderer), /Use the arrows to reorder stops/);
  assert.doesNotMatch(visibleText(renderer), /Drag to reorder/);
});

test("approved Work Mode colors Navigate blue, Arrived orange, and Ready to Depart green", async () => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { open: () => undefined } });
  const cases = [
    ["pending", "state-pending", "Navigate"],
    ["navigating", "state-navigating", "Arrive"],
    ["arrived", "state-arrived", "Depart"],
  ] as const;
  for (const [state, className, action] of cases) {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<WorkMode workday={{ ...workday, stops: [{ ...stops[0], state }, stops[1]] }} onEvent={async () => workday} />); });
    assert.equal(renderer.root.findAll(node => node.type === "section" && String(node.props.className).includes(className)).length, 1);
    assert.equal(renderer.root.findAll(node => node.type === "button" && String(node.props.className).includes("v2-work-action") && node.children.includes(action)).length, 1);
  }
});

test("Prepare My Route summarizes equipment and route before Work Mode", async () => {
  let state = initialSetupState();
  state = setupReducer(state, { type: "select-equipment", equipment: "bobtail" });
  state = setupReducer(state, { type: "change-equipment-field", field: "truckNumber", value: "124" });
  state = setupReducer(state, { type: "change-equipment-field", field: "odometer", value: "125560" });
  state = setupReducer(state, { type: "validate-equipment" });
  state = setupReducer(state, { type: "add-stop", stop: { providerId: "osm:node:1", displayName: "North Dock", address: "100 Main St, Allentown, PA", type: "delivery" } });
  state = setupReducer(state, { type: "add-stop", stop: { providerId: "osm:node:2", displayName: "South Dock", address: "200 Main St, Allentown, PA", type: "pickup" } });
  state = setupReducer(state, { type: "set-stage", stage: "prepare" });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<RouteFlow state={state} dispatch={() => undefined} onPrepare={async () => workday} />, { createNodeMock: () => ({ focus() {} }) }); });
  const text = visibleText(renderer);
  assert.match(text, /Preparing Today’s Route/);
  assert.match(text, /Truck # 124/);
  assert.match(text, /Starting Odometer 125560 MI/);
  assert.match(text, /2 Stops/);
  assert.match(text, /Start Work Mode/);
});

test("approved Experience uses a five-color gauge and auto-advances after a score", async () => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: memoryStorage() } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<ExperienceFlow workdayId="day-1" stop={{ ...stops[0], state: "departed" }} onPublish={async () => workday} />, { createNodeMock: () => ({ focus() {} }) });
  });
  const text = visibleText(renderer);
  assert.match(text, /Share your experience/);
  assert.match(text, /Yard Experience/);
  assert.match(text, /1 of 5/);
  assert.match(text, /Very Bad/);
  assert.match(text, /Excellent/);
  assert.deepEqual(renderer.root.findAll(node => node.type === "input" && node.props.name === "yard").map(node => Number(node.props.value)), [1, 2, 3, 4, 5]);
  assert.equal(renderer.root.findAll(node => node.type === "button" && node.children.some(child => child === "Next" || child === "Next ")).length, 0);
  const good = renderer.root.find(node => node.type === "input" && node.props.name === "yard" && node.props.value === 4);
  await act(async () => { good.props.onChange(); });
  assert.match(visibleText(renderer), /Staging/);
  assert.match(visibleText(renderer), /2 of 5/);
});

test("setup and Finish Day use the shared instrument panel and real icon components", async () => {
  const [equipmentSource, routeSource, finishSource] = await Promise.all([
    readFile(new URL("../app/v2/components/EquipmentFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/v2/components/RouteFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/v2/components/FinishDay.tsx", import.meta.url), "utf8"),
  ]);
  for (const source of [equipmentSource, routeSource, finishSource]) assert.doesNotMatch(source, /[←→↑↓✓]/);
  assert.match(equipmentSource, /@phosphor-icons\/react/);
  assert.match(routeSource, /@phosphor-icons\/react/);
  assert.match(finishSource, /@phosphor-icons\/react/);

  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<FinishDay workday={{ ...workday, state: "completed", activeStopIndex: 2, stops: stops.map(stop => ({ ...stop, state: "experience_published" as const })) }} onFinish={async () => workday} onDismiss={() => undefined} />);
  });
  assert.equal(renderer.root.findAll(node => String(node.props.className).includes("v2-status-mark") && node.findAll(child => child.type === "svg").length === 1).length, 1);
  assert.match(visibleText(renderer), /Today’s Summary/);
});

test("final route shows an honest Home Base handoff before Today’s Summary", async () => {
  const finalWorkday: WorkdayAggregate = { ...workday, activeStopIndex: 2, stops: stops.map(stop => ({ ...stop, state: "experience_published" as const })) };
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<FinishDay workday={finalWorkday} onFinish={async () => ({ ...finalWorkday, state: "completed" })} onDismiss={() => undefined} />); });
  assert.match(visibleText(renderer), /Proceed to Home Base/);
  assert.match(visibleText(renderer), /Home Base address is not set/);
  const summary = renderer.root.find(node => node.type === "button" && node.children.includes("Continue to Day Summary"));
  await act(async () => { summary.props.onClick(); });
  assert.match(visibleText(renderer), /Today’s Summary/);
  assert.match(visibleText(renderer), /Total Stops 2/);
  assert.match(visibleText(renderer), /Starting Odometer 456789 MI/);
  assert.match(visibleText(renderer), /Finish Day/);
});
