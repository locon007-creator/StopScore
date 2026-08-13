import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shell = await readFile(new URL("../app/v2/components/AppShell.tsx", import.meta.url), "utf8");
const app = await readFile(new URL("../app/v2/StopScoreV2App.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/v2/styles.css", import.meta.url), "utf8");
const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("header keeps the wordmark centered without temporary loading identity", () => {
  assert.doesNotMatch(shell, /Checking driver/);
  assert.match(shell, /session\.status === "loading" \? null/);
  assert.match(css, /\.v2-header-actions\s*\{[^}]*min-width:\s*(?:7[2-9]|[89]\d)px;/s);
});

test("loading and shared controls use the approved premium presentation", () => {
  assert.match(app, /v2-loading-card/);
  assert.match(app, /v2-loading-brand/);
  assert.match(css, /--v2-control-radius:\s*12px;/);
  assert.match(css, /@keyframes v2-content-enter/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(globals, /--color-app-background:\s*#FFFFFF;/);
  assert.match(globals, /--color-primary-surface:\s*#FFFFFF;/);
});
