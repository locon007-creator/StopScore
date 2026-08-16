"use client";

import { ArrowRight, Bell, Globe, ShieldCheck, User, X } from "@phosphor-icons/react";

export function SettingsPanel({ mode, onMode, onOpenSaved, onClose, driverName }: {
  mode: "light" | "dark";
  onMode: (mode: "light" | "dark") => void;
  onOpenSaved: () => void;
  onClose: () => void;
  /** Absent until sign-in carries a name; the row then reads Not set rather than an address. */
  driverName?: string | null;
}) {
  return <section className="v2-support-panel" aria-labelledby="settings-title">
    <header className="v2-support-header"><div><h1 id="settings-title">Settings</h1></div><button className="v2-icon-button" type="button" aria-label="Close Settings" onClick={onClose}><X aria-hidden="true" /></button></header>
    <div className="v2-theme-segment" aria-label="Theme">
      {(["light", "dark"] as const).map(choice => <button key={choice} data-theme-choice={choice} type="button" aria-pressed={mode === choice} onClick={() => onMode(choice)}>{choice === "light" ? "Light" : "Dark"}</button>)}
    </div>
    <div className="v2-theme-previews" aria-hidden="true">
      <div className="v2-theme-preview light"><b><span>STOP</span> SCORE</b><i /><i /><i /></div>
      <div className="v2-theme-preview dark"><b><span>STOP</span> SCORE</b><i /><i /><i /></div>
    </div>
    <div className="v2-settings-list">
      <button type="button" onClick={onOpenSaved}><span><ShieldCheck aria-hidden="true" /><strong>Saved Stops and Routes</strong></span><ArrowRight aria-hidden="true" /></button>
      <div><span><Globe aria-hidden="true" /><strong>Language</strong></span><small>English (US)</small></div>
      <div><span><User aria-hidden="true" /><strong>Driver Name</strong></span><small>{driverName || "Not set"}</small></div>
      <div><span><Bell aria-hidden="true" /><strong>Notifications</strong></span><small>Important updates</small></div>
    </div>
  </section>;
}
