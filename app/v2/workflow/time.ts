/**
 * Formatting helpers for the times recorded by Work Mode actions.
 *
 * Stop timestamps come from the `v2_stop_events` log and are optional, so every
 * helper tolerates a missing or unparseable value rather than throwing inside a
 * render pass.
 */

function parse(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Short local clock time, e.g. "2:45 PM". Returns null when unavailable. */
export function formatClockTime(value: string | undefined): string | null {
  const parsed = parse(value);
  if (!parsed) return null;
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Elapsed time between two recorded instants, rendered as "1 hr 20 min",
 * "45 min", or "Less than a minute". Returns null when either end is missing or
 * the range runs backwards.
 */
export function formatDuration(from: string | undefined, to: string | undefined): string | null {
  const start = parse(from);
  const end = parse(to);
  if (!start || !end) return null;
  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  if (totalMinutes < 0) return null;
  if (totalMinutes === 0) return "Less than a minute";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}
