import type { SetupStage } from "../setup/model.ts";

/**
 * Backward navigation for the Android system Back gesture.
 *
 * The app is a single screen driven by state rather than by routed URLs, so
 * Back is resolved against the current view and setup stage. Every entry mirrors
 * the on-screen Back control for that stage, so hardware Back and the visible
 * Back button stay in agreement.
 */

export type BackView = "loading" | "home" | "setup" | "active" | "completed";

export type BackTarget =
  | { kind: "stage"; stage: SetupStage }
  | { kind: "view"; view: BackView }
  | { kind: "exit" };

/** Mirrors the on-screen Back control for each setup stage. */
const SETUP_BACK_STAGES: Partial<Record<SetupStage, SetupStage>> = {
  "trailer-choice": "equipment-choice",
  "equipment-info": "equipment-choice",
  "equipment-ready": "equipment-info",
  "stop-type": "route-search",
  "route-list": "route-search",
  organize: "route-list",
  prepare: "route-list",
};

/**
 * Resolves where Back should go.
 *
 * Returns `{ kind: "exit" }` only when the driver is already at the first
 * screen, which lets the platform close the app. Work Mode and the completed
 * summary deliberately do not walk backwards: an active workday is server
 * authoritative and stop states cannot be un-recorded from the UI.
 */
export function resolveBackTarget(view: BackView, stage: SetupStage): BackTarget {
  if (view === "setup") {
    const previous = SETUP_BACK_STAGES[stage];
    if (previous) return { kind: "stage", stage: previous };
    // First setup stage (equipment-choice / route-search) returns to Home.
    return { kind: "view", view: "home" };
  }
  return { kind: "exit" };
}
