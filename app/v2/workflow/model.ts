import type { StopAction, StopState, WaitingCategory, WorkdayAggregate, WorkdayStop } from "../domain/workday.ts";

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

/**
 * Waiting time is measured, not asked. Arrive and Depart are already recorded for every stop,
 * so the time a driver actually spent is the authoritative answer and no one has to estimate
 * it from memory at the end of a shift.
 *
 * Band boundaries in minutes, set by the owner: Quick under 45 minutes, Standard up to 2 hours,
 * Long up to 4 hours, and anything past that Extremely Delayed. The grade a stop earns for
 * waiting follows from whichever band the measured duration lands in.
 */
export const WAITING_THRESHOLD_MINUTES = { quick: 45, standard: 120, long: 240 } as const;

/** Minutes between the recorded Arrive and Depart, or null while either is missing. */
export function stopWaitingMinutes(stop: WorkdayStop): number | null {
  if (!stop.arrivedAt || !stop.departedAt) return null;
  const arrived = Date.parse(stop.arrivedAt);
  const departed = Date.parse(stop.departedAt);
  if (!Number.isFinite(arrived) || !Number.isFinite(departed)) return null;
  if (departed < arrived) return null;
  return Math.round((departed - arrived) / 60000);
}

export function waitingCategoryFromMinutes(minutes: number): WaitingCategory {
  if (minutes < WAITING_THRESHOLD_MINUTES.quick) return "quick";
  if (minutes < WAITING_THRESHOLD_MINUTES.standard) return "standard";
  if (minutes < WAITING_THRESHOLD_MINUTES.long) return "long";
  return "extremely_delayed";
}

/** The measured waiting category for a stop, or null when the stop has not departed yet. */
export function derivedWaitingCategory(stop: WorkdayStop): WaitingCategory | null {
  const minutes = stopWaitingMinutes(stop);
  return minutes === null ? null : waitingCategoryFromMinutes(minutes);
}

/** Compact driver-facing duration, for example "18 min" or "1 hr 15 min". */
export function formatWaitingDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** Wall-clock time of a recorded event, for example "9:42 AM". */
export function formatClockTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(at);
}

/**
 * Relative day label for the last time Stop Knowledge was updated for a place, for example
 * "Updated today" or "Updated Aug 10". Calendar-day comparison, not a 24-hour window, so an
 * update from this morning still reads as "today" in the evening.
 */
export function formatUpdatedLabel(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "Updated recently";
  // Local calendar day, matching how the rest of the app renders dates, so a visit late in the
  // evening still reads as "today" locally rather than flipping a day early on a UTC boundary.
  const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  if (dayKey(at) === dayKey(now)) return "Updated today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey(at) === dayKey(yesterday)) return "Updated yesterday";
  return `Updated ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(at)}`;
}

/**
 * Minutes a driver has been at a stop that has not departed yet, so Work Mode can show elapsed
 * time while the driver is still standing in the yard.
 */
export function minutesSinceArrival(stop: WorkdayStop, now: number = Date.now()): number | null {
  if (!stop.arrivedAt || stop.departedAt) return null;
  const arrived = Date.parse(stop.arrivedAt);
  if (!Number.isFinite(arrived) || now < arrived) return null;
  return Math.round((now - arrived) / 60000);
}

/**
 * Total Miles from the two odometer readings a driver actually entered. Both must parse as
 * whole numbers and the ending reading must not be behind the starting one; otherwise this
 * returns null rather than a number that would be wrong.
 */
export function totalMiles(startOdometer: string, endOdometer: string | null | undefined): number | null {
  if (!endOdometer) return null;
  const start = Number.parseInt(startOdometer.replace(/[^0-9]/g, ""), 10);
  const end = Number.parseInt(endOdometer.replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return end - start;
}

/**
 * A driver is greeted by name only when a real name is known. Signing in without a full-name
 * claim leaves the email address as the display name, and an address is not a name to greet
 * someone by.
 */
export function driverFirstName(displayName: string | null | undefined): string | null {
  const trimmed = displayName?.trim();
  if (!trimmed || trimmed.includes("@")) return null;
  return trimmed.split(/\s+/)[0] || null;
}
