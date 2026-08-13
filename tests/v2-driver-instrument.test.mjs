import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import postcss from "postcss";

const css = await readFile(new URL("../app/v2/styles.css", import.meta.url), "utf8");
const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const sheet = postcss.parse(css);

const declarations = rule => Object.fromEntries((rule.nodes ?? []).filter(node => node.type === "decl").map(node => [node.prop, node.value]));
const finalRule = selector => sheet.nodes.filter(node => node.type === "rule" && node.selectors.includes(selector)).at(-1);
const ruleWith = (selector, property) => sheet.nodes.filter(node => node.type === "rule" && node.selectors.includes(selector)).find(node => property in declarations(node));

test("Driver Instrument exposes one bounded Android shell and stable safe-area workspace", () => {
  const shell = finalRule(".v2-app-shell");
  const header = finalRule(".v2-header");
  const workspace = finalRule(".v2-workspace");
  assert.ok(shell && header && workspace);
  assert.match(declarations(shell).width, /min\(100%,\s*480px\)/);
  assert.match(declarations(shell).height, /100dvh/);
  assert.match(declarations(header).height, /safe-area-inset-top/);
  assert.match(declarations(workspace).height, /safe-area-inset-top/);
  assert.equal(declarations(workspace)["overflow-y"], "auto");
});

test("Driver Instrument uses one premium control geometry and large operational inputs", () => {
  const primary = ruleWith(".v2-primary-button", "min-height");
  const input = finalRule(".v2-form input");
  const icon = finalRule(".v2-icon-button");
  assert.ok(primary && input && icon);
  assert.ok(Number.parseFloat(declarations(primary)["min-height"] ?? "0") >= 58);
  assert.equal(declarations(primary)["border-radius"], "var(--radius-control)");
  assert.ok(Number.parseFloat(declarations(input)["min-height"] ?? "0") >= 64);
  assert.equal(declarations(input)["border-radius"], "var(--radius-control)");
  assert.ok(Number.parseFloat(declarations(icon).width ?? "0") >= 44);
  assert.ok(Number.parseFloat(declarations(icon).height ?? "0") >= 44);
});

test("Driver Instrument keeps operational panels restrained and state accents semantic", () => {
  const active = finalRule(".v2-active-stop-panel");
  const experience = finalRule(".v2-experience-card");
  const navigating = finalRule(".v2-work-mode.state-navigating");
  const arrived = finalRule(".v2-work-mode.state-arrived");
  assert.ok(active && experience && navigating && arrived);
  assert.equal(declarations(active)["border-radius"], "var(--radius-panel)");
  assert.equal(declarations(active).background, "var(--color-primary-surface)");
  assert.equal(declarations(experience)["border-radius"], "var(--radius-panel)");
  assert.equal(declarations(navigating)["--state-accent"], "var(--color-warning)");
  assert.equal(declarations(arrived)["--state-accent"], "var(--color-success)");
});

test("Driver Instrument themes and motion are centralized and accessibility-safe", () => {
  for (const token of ["type-display", "type-title", "type-body", "type-label", "elevation-operational", "elevation-overlay", "motion-press", "motion-screen"]) {
    assert.match(globals, new RegExp(`--${token}\\s*:`), `missing ${token}`);
  }
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media\s*\(max-width:\s*340px\)/);
  assert.match(css, /@media\s*\(min-width:\s*760px\)/);
  assert.match(css, /:root\[data-theme="light"\] \.v2-workspace[\s\S]*background:\s*#fff/);
});
