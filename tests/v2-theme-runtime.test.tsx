import assert from "node:assert/strict";
import test from "node:test";

test("auto resolves to the current device theme while explicit choices stay fixed", async () => {
  const theme = await import("../app/theme.tsx") as Record<string, unknown>;
  assert.equal(typeof theme.resolveThemeMode, "function");
  const resolveThemeMode = theme.resolveThemeMode as (mode: "auto" | "light" | "dark", systemDark: boolean) => "light" | "dark";

  assert.equal(resolveThemeMode("auto", true), "dark");
  assert.equal(resolveThemeMode("auto", false), "light");
  assert.equal(resolveThemeMode("dark", false), "dark");
  assert.equal(resolveThemeMode("light", true), "light");
});

test("the persisted theme contract still offers Auto but defaults new drivers to Dark", async () => {
  const theme = await import("../app/theme.tsx") as Record<string, unknown>;
  assert.deepEqual(theme.themeModes, ["auto", "light", "dark"]);
  // StopScore is designed dark and the approved boards are dark, so a driver who has chosen
  // nothing gets Dark rather than whatever their phone happens to be set to.
  assert.equal(theme.defaultTheme, "dark");
});
