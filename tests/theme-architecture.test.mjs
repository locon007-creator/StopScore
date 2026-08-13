import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const readAppFile = file => readFile(resolve(projectRoot, "app", file), "utf8");

test("StopScore uses one persisted light, dark, and auto theme source", async () => {
  const [theme, layout, page, shell, settings, css, v2css] = await Promise.all([
    readAppFile("theme.tsx"),
    readAppFile("layout.tsx"),
    readAppFile("page.tsx"),
    readAppFile("v2/components/AppShell.tsx"),
    readAppFile("v2/components/SettingsPanel.tsx"),
    readAppFile("globals.css"),
    readAppFile("v2/styles.css"),
  ]);

  assert.match(theme, /themeModes = \["auto", "light", "dark"\]/);
  assert.match(theme, /export type ThemeMode/);
  assert.match(theme, /resolveThemeMode/);
  assert.match(theme, /driverPreferencesStorageKey/);
  assert.match(theme, /localStorage\.setItem\(driverPreferencesStorageKey/);
  assert.match(theme, /document\.documentElement/);
  assert.match(theme, /meta\[name="theme-color"\]/);
  assert.match(theme, /typeof window\.matchMedia === "function"/);
  assert.match(theme, /catch \{\s*try \{\s*window\.localStorage\.setItem/);
  assert.match(theme, /matchMedia\("\(prefers-color-scheme: dark\)"\)/);

  assert.match(layout, /<ThemeProvider>\{children\}<\/ThemeProvider>/);
  assert.match(layout, /localStorage\.getItem\("stopscore-driver-preferences"\)/);
  assert.match(layout, /document\.documentElement\.dataset\.theme/);
  assert.match(layout, /document\.documentElement\.dataset\.themePreference/);
  assert.match(layout, /meta\[name="theme-color"\]/);
  assert.match(layout, /matchMedia\("\(prefers-color-scheme: dark\)"\)/);
  assert.match(layout, /catch \{[\s\S]*document\.querySelector\('meta\[name="theme-color"\]'\)/);

  assert.match(page, /<StopScoreV2App \/>/);
  assert.match(shell, /useTheme\(\)/);
  assert.match(shell, /theme-control-trigger/);
  assert.match(shell, /<SettingsPanel/);
  assert.match(settings, /\["light", "dark"\] as const/);
  assert.match(settings, /choice === "light" \? "Light" : "Dark"/);
  assert.doesNotMatch(settings, /"auto"/);
  assert.match(settings, /Saved Stops and Routes/);
  assert.doesNotMatch(shell, /settings-appearance-row|<option value="(system|light|dark)"|Use device setting/);
  assert.doesNotMatch(shell, /useState[^\n]*themeMode/);

  for (const token of [
    "app-background",
    "primary-surface",
    "secondary-surface",
    "raised-surface",
    "input-background",
    "primary-text",
    "secondary-text",
    "border",
    "overlay",
    "brand",
    "success",
    "warning",
    "destructive",
  ]) {
    assert.match(css, new RegExp(`--color-${token}\\s*:`), `missing semantic token: ${token}`);
  }

  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /:root\[data-theme="light"\]/);

  const lightTheme = css.match(/:root\[data-theme="light"\]\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  for (const token of [
    "app-background",
    "primary-surface",
    "raised-surface",
    "input-background",
    "modal-surface",
    "nav-surface",
  ]) {
    assert.match(lightTheme, new RegExp(`--color-${token}\\s*:\\s*#FFFFFF`), `Light ${token} must be pure white`);
  }
  assert.match(lightTheme, /--color-secondary-surface\s*:\s*#f5f6f7/i);
  assert.match(css, /:root\[data-theme="light"\] \.home-screen \.hero-image\s*\{\s*opacity:\s*0;/);
  assert.match(v2css, /:root\[data-theme="light"\] \.v2-home-backdrop\s*\{[\s\S]*opacity:\s*\.52;?/);
  assert.match(v2css, /:root\[data-theme="light"\] \.v2-home-backdrop\s*\{[\s\S]*filter:\s*brightness\(1\.18\) contrast\(\.82\) saturate\(\.72\);?/);
  assert.match(v2css, /:root\[data-theme="light"\] \.v2-home-shade\s*\{[\s\S]*linear-gradient\(180deg,/);
  assert.match(v2css, /:root\[data-theme="light"\] \.v2-home\s*\{[\s\S]*color:\s*var\(--color-primary-text\)/);

  assert.match(css, /\.theme-control-trigger/);
  assert.match(css, /\.theme-popover/);
  assert.match(css, /\.delete-actions button:last-child[\s\S]*var\(--color-destructive\)/);
  assert.match(css, /\.delete-actions button:not\(:last-child\)[\s\S]*var\(--color-secondary-surface\)/);
});
