import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SettingsPanel } from "../app/v2/components/SettingsPanel.tsx";
import { SavedItemsPanel } from "../app/v2/components/SavedItemsPanel.tsx";

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
