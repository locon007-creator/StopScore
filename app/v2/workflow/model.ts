import type { StopAction, StopState, WorkdayAggregate } from "../domain/workday.ts";

export const EQUIPMENT_DISPLAY_ORDER = ["Truck #", "Trailer Type", "TRL #", "Odometer"] as const;
export const DROP_HOOK_DETAIL_LABELS = ["TRL # dropped", "TRL # picked up", "Reference #"] as const;

export type WorkModeAction =
  | { kind: "event"; action: StopAction; label: "Navigate" | "Arrive" | "Depart" }
  | { kind: "experience"; label: "Add Stop Knowledge" };

export function getWorkModeAction(state: StopState): WorkModeAction | null {
  if (state === "pending") return { kind: "event", action: "navigate", label: "Navigate" };
  if (state === "navigating") return { kind: "event", action: "arrive", label: "Arrive" };
  if (state === "arrived") return { kind: "event", action: "depart", label: "Depart" };
  if (state === "departed") return { kind: "experience", label: "Add Stop Knowledge" };
  return null;
}

export function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, " ");
}

export function navigationTarget(address: string) {
  const normalized = normalizeAddress(address);
  return {
    address: normalized,
    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalized)}`,
  };
}

export function resolveWorkflowPresentation(workday: WorkdayAggregate): { focusId: string; announcement: string } {
  if (workday.state === "completed") {
    return { focusId: "finish-day-title", announcement: `Workday complete. ${workday.stops.length} ${workday.stops.length === 1 ? "stop" : "stops"} finished.` };
  }
  if (workday.activeStopIndex >= workday.stops.length) {
    return { focusId: "finish-day-title", announcement: workday.stops.length === 1 ? "The stop is complete. Finish your workday." : `All ${workday.stops.length} stops are complete. Finish your workday.` };
  }
  const stop = workday.stops[workday.activeStopIndex];
  if (!stop) return { focusId: "workmode-title", announcement: "Workday active." };
  if (stop.state === "departed") {
    return { focusId: `experience-${stop.id}-yard`, announcement: `Stop Knowledge for ${stop.displayName}.` };
  }
  const action = getWorkModeAction(stop.state);
  return {
    focusId: `workmode-${stop.id}-action`,
    announcement: `Stop ${workday.activeStopIndex + 1} of ${workday.stops.length}. ${stop.displayName}. ${action?.label ?? "In progress"}.`,
  };
}
