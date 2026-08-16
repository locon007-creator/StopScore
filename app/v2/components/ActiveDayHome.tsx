"use client";

import { forwardRef } from "react";
import { MapPin } from "@phosphor-icons/react";
import type { WorkdayAggregate } from "../domain/workday.ts";
import type { SessionState } from "../useWorkday";
import { driverFirstName, formatClockTime } from "../workflow/model.ts";

const greeting = (hour: number) => {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const formattedDate = (date: Date) => new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
}).format(date);

/**
 * Home as a driver finds it partway through a day. The current and next stop are shown so a
 * driver reopening the app knows where they stand before returning to Work Mode. Arrival times
 * come from what was recorded; a stop with nothing recorded shows nothing rather than a guess.
 */
export const ActiveDayHome = forwardRef<HTMLButtonElement, {
  session: SessionState;
  workday: WorkdayAggregate;
  onContinue: () => void;
}>(function ActiveDayHome({ session, workday, onContinue }, ref) {
  const now = new Date();
  const driverName = session.status === "authenticated" ? driverFirstName(session.user.displayName) : null;
  const current = workday.stops[workday.activeStopIndex];
  const next = workday.stops[workday.activeStopIndex + 1];
  const arrived = formatClockTime(current?.arrivedAt);

  return (
    <section className="v2-home v2-active-home" aria-labelledby="active-home-greeting">
      <div className="v2-home-content">
        <div className="v2-home-copy">
          {/* Local immutable asset does not need an optimizer request. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="v2-home-logo" src="/assets/stopscore-logo-horizontal.png" alt="StopScore" width={1200} height={229} />
          <h1 id="active-home-greeting">{greeting(now.getHours())}{driverName ? `, ${driverName}` : ""}</h1>
          <p className="v2-home-date">{formattedDate(now)}</p>
        </div>

        <div className="v2-active-home-stops">
          {current ? (
            <article className="v2-active-home-card">
              <p className="v2-eyebrow">Current Stop</p>
              <strong>{current.displayName}</strong>
              <span><MapPin aria-hidden="true" weight="duotone" />{current.address}</span>
              {arrived ? <small>Arrived {arrived}</small> : null}
            </article>
          ) : null}

          {next ? (
            <article className="v2-active-home-card">
              <p className="v2-eyebrow">Next Stop</p>
              <strong>{next.displayName}</strong>
              <span><MapPin aria-hidden="true" weight="duotone" />{next.address}</span>
            </article>
          ) : null}
        </div>

        <div className="v2-home-dashboard">
          <button ref={ref} className="v2-primary-button v2-home-action" type="button" onClick={onContinue}>
            <span>Continue with your day</span>
          </button>
          <p className="v2-gps-disclaimer">StopScore is not a GPS.</p>
        </div>
      </div>
    </section>
  );
});
