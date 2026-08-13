import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const v2 = await readFile(new URL("../app/v2/styles.css", import.meta.url), "utf8");

test("dark theme uses the approved restrained graphite and crimson blend", () => {
  assert.match(globals, /--color-app-background:\s*#070809;/);
  assert.match(globals, /--color-primary-surface:\s*#111315;/);
  assert.match(globals, /--color-secondary-surface:\s*#171a1d;/);
  assert.match(globals, /--color-border:\s*rgba\(255,255,255,\.10\);/);
  assert.match(globals, /--color-app-gradient:\s*radial-gradient\(circle at 50% -10%, #241014 0, #111316 36%, #070809 76%\);/);
  assert.match(v2, /\.v2-app-shell\s*\{[\s\S]*background:\s*var\(--color-app-gradient\);/);
  assert.match(v2, /:root\[data-theme="dark"\] \.v2-primary-button[\s\S]*linear-gradient\(135deg, #ff3543, #d70d24\)/);
});

test("semantic state colors and pure-white light foundation remain protected", () => {
  assert.match(globals, /--color-navigating:\s*#1769aa;/);
  assert.match(v2, /state-navigating\s*\{\s*--state-accent:\s*var\(--color-warning\);?/);
  assert.match(v2, /state-arrived\s*\{\s*--state-accent:\s*var\(--color-success\);?/);
  assert.match(globals, /:root\[data-theme="light"\][\s\S]*--color-app-background:\s*#FFFFFF;/);
  assert.match(globals, /:root\[data-theme="light"\][\s\S]*--color-primary-surface:\s*#FFFFFF;/);
});
