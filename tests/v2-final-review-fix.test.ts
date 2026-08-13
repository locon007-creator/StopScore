import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import postcss, { type AtRule, type Declaration, type Rule } from "postcss";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("place search authenticates before query classification or provider budget work", async () => {
  const { createPlaceSearchHttpHandler } = await import("../app/v2/server/place-search-http.ts");
  const calls: string[] = [];
  const anonymous = createPlaceSearchHttpHandler({
    authenticate: async () => { calls.push("auth"); return null; },
    search: async () => { calls.push("provider"); return { kind: "empty" as const, suggestions: [] }; },
  });
  const response = await anonymous(new Request("https://app.local/api/place-search?q=valid%20query"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: { code: "unauthenticated", message: "Sign in to search for places." } });
  assert.deepEqual(calls, ["auth"]);

  const authenticatedCalls: string[] = [];
  const authenticated = createPlaceSearchHttpHandler({
    authenticate: async () => { authenticatedCalls.push("auth"); return { email: "driver@example.com" }; },
    search: async () => { authenticatedCalls.push("provider"); return { kind: "empty" as const, suggestions: [] }; },
  });
  assert.equal((await authenticated(new Request("https://app.local/api/place-search?q=ab"))).status, 200);
  assert.deepEqual(authenticatedCalls, ["auth"], "short queries must not reach Photon after authentication");
});

function rgb(hex: string) {
  const normalized = hex.replace("#", "");
  return [0, 2, 4].map(index => Number.parseInt(normalized.slice(index, index + 2), 16));
}

function luminance(hex: string) {
  const channels = rgb(hex).map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(left: string, right: string) {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function declarations(rule: Rule) {
  return Object.fromEntries(rule.nodes.filter((node): node is Declaration => node.type === "decl").map(node => [node.prop.replace(/^--/, ""), node.value]));
}

test("actual theme tokens compute to AA action/text and visible focus contrast", async () => {
  const css = await readFile(resolve(root, "app/globals.css"), "utf8");
  const stylesheet = postcss.parse(css);
  const darkRule = stylesheet.nodes.find((node): node is Rule => node.type === "rule" && node.selectors.includes(":root") && node.selectors.includes(':root[data-theme="dark"]'));
  const lightRule = stylesheet.nodes.find((node): node is Rule => node.type === "rule" && node.selectors.includes(':root[data-theme="light"]'));
  assert.ok(darkRule && lightRule, "both production theme rules must parse");
  const dark = declarations(darkRule);
  const light = { ...dark, ...declarations(lightRule) };
  for (const [name, theme] of [["dark", dark], ["light", light]] as const) {
    for (const action of ["color-brand", "color-destructive", "color-success", "color-navigating"]) {
      assert.ok(contrast(theme[action], theme["color-on-brand"]) >= 4.5, `${name} ${action} needs 4.5:1 normal-text contrast`);
    }
    assert.ok(contrast(theme["color-tertiary-text"], theme["color-app-background"]) >= 4.5, `${name} tertiary text needs AA contrast`);
    assert.ok(contrast(theme["color-focus"], theme["color-app-background"]) >= 3, `${name} focus indicator needs 3:1 contrast`);
    assert.ok(contrast(theme["color-focus"], theme["color-primary-surface"]) >= 3, `${name} focus indicator needs surface contrast`);
  }
});

test("the production v2 control floor computes to at least 44 CSS pixels", async () => {
  const css = await readFile(resolve(root, "app/v2/styles.css"), "utf8");
  const stylesheet = postcss.parse(css);
  const requiredSelectors = [".v2-app-shell button", ".v2-app-shell input", ".v2-app-shell select", ".v2-app-shell a"];
  const floorRule = stylesheet.nodes.find((node): node is Rule => node.type === "rule" && requiredSelectors.every(selector => node.selectors.includes(selector)));
  assert.ok(floorRule, "the production stylesheet must expose one locked interactive floor");
  const minHeight = Number.parseFloat(declarations(floorRule)["min-height"] ?? "0");
  assert.ok(minHeight >= 44, `interactive target floor was ${minHeight}px`);
  const iconRule = stylesheet.nodes.find((node): node is Rule => node.type === "rule" && node.selectors.includes(".v2-icon-button"));
  assert.ok(iconRule, "the icon control rule must parse");
  const icon = declarations(iconRule);
  assert.ok(Number.parseFloat(icon.width ?? "0") >= 44);
  assert.ok(Number.parseFloat(icon.height ?? "0") >= 44);
});

test("equipment and trailer selection render horizontal snap rails with a persistent action bar", async () => {
  const css = await readFile(resolve(root, "app/v2/styles.css"), "utf8");
  const stylesheet = postcss.parse(css);
  const findRule = (selector: string) => stylesheet.nodes.filter((node): node is Rule => node.type === "rule" && node.selectors.includes(selector)).at(-1);

  const list = stylesheet.nodes.filter((node): node is Rule => node.type === "rule" && node.selectors.includes(".v2-equipment-grid")).find(rule => declarations(rule).display === "grid");
  assert.ok(list, "equipment list must parse");
  assert.equal(declarations(list).display, "grid");
  assert.equal(declarations(list)["grid-auto-flow"], "column");
  assert.equal(declarations(list)["overflow-x"], "auto");
  assert.equal(declarations(list)["scroll-snap-type"], "x mandatory");

  const heading = findRule(".v2-equipment-heading h1");
  assert.ok(heading, "equipment heading must parse");
  assert.notEqual(declarations(heading)["white-space"], "nowrap", "large text must be allowed to wrap without clipping");

  const card = findRule(".v2-equipment-card");
  assert.ok(card, "equipment card must parse");
  assert.ok(Number.parseFloat(declarations(card)["min-width"] ?? "0") >= 250);
  assert.equal(declarations(card)["scroll-snap-align"], "start");

  const selected = findRule(".v2-equipment-card.selected");
  assert.ok(selected, "selected card state must parse");
  assert.equal(declarations(selected)["border-color"], "var(--color-brand)");

  const dock = stylesheet.nodes.filter((node): node is Rule => node.type === "rule" && node.selectors.includes(".v2-equipment-dock")).find(rule => declarations(rule).position === "fixed");
  assert.ok(dock, "equipment confirmation bar must parse");
  assert.equal(declarations(dock).position, "fixed");
  assert.match(declarations(dock).bottom ?? "", /safe-area-inset-bottom/);

  const trailers = stylesheet.nodes.filter((node): node is Rule => node.type === "rule" && node.selectors.includes(".v2-trailer-options")).find(rule => declarations(rule).display === "grid");
  assert.ok(trailers, "trailer rail must parse");
  assert.equal(declarations(trailers).display, "grid");
  assert.equal(declarations(trailers)["grid-auto-flow"], "column");
  assert.equal(declarations(trailers)["overflow-x"], "auto");
  assert.equal(declarations(trailers)["scroll-snap-type"], "x mandatory");

  const compactMedia = stylesheet.nodes.find((node): node is AtRule => node.type === "atrule" && node.name === "media" && node.params.includes("max-height:740px"));
  assert.ok(compactMedia, "short Android viewports need a compact equipment layout");
  const compactCard = compactMedia.nodes?.find((node): node is Rule => node.type === "rule" && node.selectors.includes(".v2-equipment-card"));
  assert.ok(compactCard, "compact equipment card rule must parse");
  assert.ok(Number.parseFloat(declarations(compactCard)["min-height"] ?? "999") <= 214);
  assert.equal(compactMedia.nodes?.some((node): node is Rule => node.type === "rule" && node.selectors.includes(".v2-workspace")), false, "equipment compaction must not alter unrelated screens");
});

test("equipment information uses a larger raised panel with controlled red definition", async () => {
  const css = await readFile(resolve(root, "app/v2/styles.css"), "utf8");
  const stylesheet = postcss.parse(css);
  const findRule = (selector: string) => stylesheet.nodes.filter((node): node is Rule => node.type === "rule" && node.selectors.includes(selector)).at(-1);
  const form = findRule(".v2-equipment-form");
  assert.ok(form, "equipment information panel must parse");
  assert.match(declarations(form).background ?? "", /color-primary-surface/);
  assert.match(declarations(form).border ?? "", /color-brand/);
  assert.match(declarations(form).padding ?? "", /var\(--space-5\)|2[0-9]px/);

  const input = stylesheet.nodes.filter((node): node is Rule => node.type === "rule" && node.selectors.includes(".v2-equipment-form input")).find(rule => (declarations(rule).border ?? "").includes("color-brand"));
  assert.ok(input, "equipment input rule must parse");
  assert.ok(Number.parseFloat(declarations(input)["min-height"] ?? "0") >= 68);
  assert.match(declarations(input).border ?? "", /color-brand/);
  assert.ok(Number.parseFloat(declarations(input)["font-size"] ?? "0") >= 1.1);
});
