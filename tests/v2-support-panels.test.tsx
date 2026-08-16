import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SettingsPanel } from "../app/v2/components/SettingsPanel.tsx";
import { SavedItemsPanel } from "../app/v2/components/SavedItemsPanel.tsx";
import { StopKnowledgePanel } from "../app/v2/components/StopKnowledgePanel.tsx";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const textOf = (renderer: TestRenderer.ReactTestRenderer) => renderer.root.findAll(() => true).flatMap(node => node.children.filter((child): child is string => typeof child === "string")).join(" ").replace(/\s+/g, " ");

test("Settings exposes exactly Light and Dark plus the Saved Stops and Routes entry", async () => {
  let selected = "";
  let savedOpened = 0;
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<SettingsPanel mode="dark" onMode={mode => { selected = mode; }} onOpenSaved={() => { savedOpened += 1; }} onClose={() => undefined} />);
  });
  const themeButtons = renderer.root.findAll(node => node.type === "button" && node.props["data-theme-choice"]);
  assert.deepEqual(themeButtons.map(button => button.children[0]), ["Light", "Dark"]);
  assert.equal(renderer.root.findAll(node => String(node.props.className).split(/\s+/).includes("v2-theme-preview")).length, 2);
  await act(async () => { themeButtons[0].props.onClick(); });
  assert.equal(selected, "light");
  const saved = renderer.root.find(node => node.type === "button" && node.findAll(child => child.type === "strong" && child.children.includes("Saved Stops and Routes")).length === 1);
  await act(async () => { saved.props.onClick(); });
  assert.equal(savedOpened, 1);
});

test("Saved items renders separate collapsible stop and route groups from real loader data", async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<SavedItemsPanel onClose={() => undefined} loadItems={async () => ({
      stops: [{ id: 1, name: "North Dock", address: "100 Main St, Allentown, PA", type: "Delivery" }],
      routes: [{ id: 2, name: "Tuesday Route", stops: [{ name: "North Dock", address: "100 Main St, Allentown, PA", type: "Delivery", open: "—", close: "—" }] }],
    })} />);
  });
  await act(async () => { await Promise.resolve(); });
  const text = textOf(renderer);
  assert.match(text, /Saved Stops/);
  assert.match(text, /Saved Routes/);
  assert.match(text, /North Dock/);
  assert.match(text, /Tuesday Route/);
});

const knowledgeStop = {
  id: "stop-1",
  providerId: "osm:node:555",
  displayName: "Pinnacle Freight Solutions",
  address: "7425 Industrial Pkwy, Memphis, TN 38118",
  type: "delivery" as const,
  order: 0,
  state: "departed" as const,
};

test("Stop Knowledge renders the overall score, five topic scores, and driver comments from real loader data", async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<StopKnowledgePanel stop={knowledgeStop} onClose={() => undefined} loadKnowledge={async () => ({
      experienceCount: 2,
      overallScore: 4,
      topicScores: { yard: 4, staging: 4, staff: 4, waitingTime: 3, bathroomAccess: 4 },
      updatedAt: new Date().toISOString(),
      comments: ["Check-in staff was helpful.", "Tight yard but well organized."],
    })} />);
  });
  await act(async () => { await Promise.resolve(); });
  const text = textOf(renderer);
  assert.match(text, /Pinnacle Freight Solutions/);
  assert.match(text, /2 Experiences/);
  assert.match(text, /Updated today/);
  assert.doesNotMatch(text, /No StopScore yet/);
  assert.doesNotMatch(text, /No shared experience/);
  const overall = renderer.root.find(node => String(node.props.className).includes("v2-overall-score"));
  assert.equal(overall.children.length > 0, true);
  assert.match(text, /Check-in staff was helpful\./);
  assert.match(text, /Tight yard but well organized\./);
});

test("Stop Knowledge keeps its honest empty state when nobody has published for this stop yet", async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<StopKnowledgePanel stop={knowledgeStop} onClose={() => undefined} loadKnowledge={async () => null} />);
  });
  await act(async () => { await Promise.resolve(); });
  const text = textOf(renderer);
  assert.match(text, /No StopScore yet/);
  assert.match(text, /No shared experience has been published for this stop yet\./);
  assert.match(text, /No driver comments yet\./);
});

test("Stop Knowledge shows an inline error rather than blocking when the request fails", async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<StopKnowledgePanel stop={knowledgeStop} onClose={() => undefined} loadKnowledge={async () => { throw new Error("Stop Knowledge is unavailable."); }} />);
  });
  await act(async () => { await Promise.resolve(); });
  const text = textOf(renderer);
  assert.match(text, /Stop Knowledge is unavailable\./);
  assert.equal(renderer.root.findAll(node => node.props.role === "dialog").length, 1, "the panel stays open and closable on failure");
  assert.doesNotMatch(text, /No StopScore yet/);
});
