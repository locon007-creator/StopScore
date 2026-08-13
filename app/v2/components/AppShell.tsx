"use client";

import { useState, type ReactNode } from "react";
import { GearSix, GlobeHemisphereWest, SignIn } from "@phosphor-icons/react";
import { useTheme } from "../../theme";
import type { SessionState } from "../useWorkday";
import { SettingsPanel } from "./SettingsPanel";
import { SavedItemsPanel } from "./SavedItemsPanel";

export function AppShell({ session, children }: { session: SessionState; children: ReactNode }) {
  const { mode, resolvedMode, setMode } = useTheme();
  const [supportView, setSupportView] = useState<"settings" | "saved" | null>(null);

  const identity = session.status === "authenticated" ? session.user.displayName : session.status === "loading" ? null : "Sign In";

  return (
    <div className="v2-app-shell">
      <header className={`v2-header${session.status !== "loading" ? " v2-header-ready" : ""}`}>
        <div className="v2-language-control" aria-label="Language: English (United States)" title="English (United States)">
          <GlobeHemisphereWest aria-hidden="true" />
          {/* Local immutable asset does not need an optimizer request. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/us-language-reference.png" alt="" width={36} height={36} />
          <span>US</span>
        </div>
        <div className="v2-brand-lockup" aria-label="StopScore Driver OS home">
          {/* Local immutable asset does not need an optimizer request. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/stopscore-logo-header.png" alt="StopScore" width={312} height={96} />
        </div>
        <div className="v2-header-actions">
          {session.status === "unauthenticated" ? (
            <a className="v2-driver-state" href="/signin-with-chatgpt?return_to=%2F"><span>{identity}</span><SignIn aria-hidden="true" /></a>
          ) : session.status === "loading" ? null : <span className="v2-driver-state" title={session.status === "authenticated" ? session.user.email : undefined}>{identity}</span>}
          <div className="v2-settings">
            <button className="v2-icon-button theme-control-trigger" type="button" aria-label="Settings and theme" aria-expanded={supportView === "settings"} onClick={() => setSupportView("settings")}>
              <GearSix aria-hidden="true" weight="regular" />
            </button>
          </div>
        </div>
      </header>
      <main className="v2-workspace">{children}</main>
      {supportView === "settings" ? <SettingsPanel mode={mode === "auto" ? resolvedMode : mode} onMode={setMode} onOpenSaved={() => setSupportView("saved")} onClose={() => setSupportView(null)} /> : null}
      {supportView === "saved" ? <SavedItemsPanel onClose={() => setSupportView("settings")} /> : null}
    </div>
  );
}
