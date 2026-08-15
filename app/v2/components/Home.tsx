"use client";

import { forwardRef } from "react";
import { Cloud, RoadHorizon } from "@phosphor-icons/react";
import type { SessionState } from "../useWorkday";
import { driverFirstName } from "../workflow/model.ts";

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

export const Home = forwardRef<HTMLButtonElement, { session: SessionState; onStart: () => void; onRetrySession: () => void }>(function Home({ session, onStart, onRetrySession }, ref) {
  const now = new Date();
  const driverName = session.status === "authenticated" ? driverFirstName(session.user.displayName) : null;
  return (
    <section className="v2-home" aria-labelledby="home-greeting">
      <div className="v2-home-backdrop" style={{ backgroundImage: "url(/assets/stopscore-road-hero.webp)" }} aria-hidden="true" />
      <div className="v2-home-shade" aria-hidden="true" />
      <div className="v2-home-content">
        <div className="v2-home-copy">
          {/* Local immutable asset does not need an optimizer request. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="v2-home-logo" src="/assets/stopscore-logo-horizontal.png" alt="StopScore" width={1200} height={229} />
          <h1 id="home-greeting">{greeting(now.getHours())}{driverName ? `, ${driverName}` : ""}</h1>
          <p className="v2-home-date">{formattedDate(now)}</p>
        </div>
        <div className="v2-home-dashboard">
          <div className="v2-home-instrument" aria-label="Weather and traffic">
            <a href="https://weather.com/weather/today/" target="_blank" rel="noreferrer"><Cloud className="v2-home-utility-icon" aria-hidden="true" weight="regular" /><span><strong>Check Weather</strong><small>Current conditions</small></span></a>
            <span className="v2-home-instrument-divider" aria-hidden="true" />
            <a href="https://www.google.com/maps/@?api=1&map_action=map" target="_blank" rel="noreferrer"><RoadHorizon className="v2-home-utility-icon" aria-hidden="true" weight="regular" /><span><strong>View Traffic</strong><small>Open live map</small></span></a>
          </div>
          {session.status === "error" ? (
            <div className="v2-inline-error" role="alert">
              <p>{session.message}</p>
              <button className="v2-secondary-button" type="button" onClick={onRetrySession}>Try Again</button>
            </div>
          ) : (
            <button ref={ref} className="v2-primary-button v2-home-action" type="button" disabled={session.status === "loading"} onClick={onStart}>
              <span>{session.status === "loading" ? "Checking sign-in…" : "Start My Day"}</span>
            </button>
          )}
          <p className="v2-gps-disclaimer">StopScore is not a GPS.</p>
        </div>
      </div>
    </section>
  );
});
