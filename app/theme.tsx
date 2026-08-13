"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const themeModes = ["auto", "light", "dark"] as const;
export type ThemeMode = (typeof themeModes)[number];
export type ResolvedThemeMode = Exclude<ThemeMode, "auto">;

export const driverPreferencesStorageKey = "stopscore-driver-preferences";

export const defaultTheme: ThemeMode = "auto";

const isThemeMode = (value: unknown): value is ThemeMode => themeModes.includes(value as ThemeMode);

export const resolveThemeMode = (mode: ThemeMode, systemDark: boolean): ResolvedThemeMode =>
  mode === "auto" ? (systemDark ? "dark" : "light") : mode;

const readSystemPrefersDark = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

export const readStoredThemeMode = (): ThemeMode => {
  if (typeof window === "undefined") return defaultTheme;
  try {
    const stored = JSON.parse(window.localStorage.getItem(driverPreferencesStorageKey) || "{}") as { themeMode?: unknown };
    return isThemeMode(stored.themeMode) ? stored.themeMode : defaultTheme;
  } catch {
    return defaultTheme;
  }
};

export const persistDriverPreferences = (preferences: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(driverPreferencesStorageKey) || "{}") as Record<string, unknown>;
    window.localStorage.setItem(driverPreferencesStorageKey, JSON.stringify({ ...stored, ...preferences }));
  } catch {
    try {
      window.localStorage.setItem(driverPreferencesStorageKey, JSON.stringify(preferences));
    } catch {
      /* Theme selection still applies for this session when storage is unavailable. */
    }
  }
};

export const applyThemeToDocument = (mode: ThemeMode, systemDark = readSystemPrefersDark()) => {
  if (typeof document === "undefined") return;
  const resolvedMode = resolveThemeMode(mode, systemDark);
  const root = document.documentElement;
  root.dataset.themePreference = mode;
  root.dataset.theme = resolvedMode;
  root.style.colorScheme = resolvedMode;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", resolvedMode === "dark" ? "#050505" : "#ffffff");
};

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredThemeMode);
  const [systemDark, setSystemDark] = useState(readSystemPrefersDark);
  const resolvedMode = resolveThemeMode(mode, systemDark);

  const setMode = useCallback((nextMode: ThemeMode) => {
    applyThemeToDocument(nextMode, systemDark);
    persistDriverPreferences({ themeMode: nextMode });
    setModeState(nextMode);
  }, [systemDark]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    applyThemeToDocument(mode, systemDark);
  }, [mode, systemDark]);

  const value = useMemo(() => ({ mode, resolvedMode, setMode }), [mode, resolvedMode, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
