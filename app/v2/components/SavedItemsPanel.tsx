"use client";

import { useEffect, useState } from "react";
import { MapPin, Path, X } from "@phosphor-icons/react";

export type SavedStopItem = { id: number; name: string; address: string; type: string | null };
export type SavedRouteItem = { id: number; name: string; stops: Array<{ name: string; address: string; type: string; open: string; close: string }> };
export type SavedItems = { stops: SavedStopItem[]; routes: SavedRouteItem[] };

async function defaultLoadItems(): Promise<SavedItems> {
  const [stopsResponse, routesResponse] = await Promise.all([fetch("/api/saved-stops"), fetch("/api/saved-routes")]);
  const stopsBody = await stopsResponse.json() as { savedStops?: SavedStopItem[]; error?: string };
  const routesBody = await routesResponse.json() as { savedRoutes?: SavedRouteItem[]; error?: string };
  if (!stopsResponse.ok && stopsResponse.status !== 401) throw new Error(stopsBody.error || "Saved Stops are unavailable.");
  if (!routesResponse.ok && routesResponse.status !== 401) throw new Error(routesBody.error || "Saved Routes are unavailable.");
  return { stops: stopsBody.savedStops ?? [], routes: routesBody.savedRoutes ?? [] };
}

export function SavedItemsPanel({ onClose, loadItems = defaultLoadItems }: { onClose: () => void; loadItems?: () => Promise<SavedItems> }) {
  const [items, setItems] = useState<SavedItems | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void loadItems().then(value => { if (live) setItems(value); }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : "Saved items are unavailable."); });
    return () => { live = false; };
  }, [loadItems]);
  return <section className="v2-support-panel" aria-labelledby="saved-title">
    <header className="v2-support-header"><div><h1 id="saved-title">Saved Stops &amp; Routes</h1></div><button className="v2-icon-button" type="button" aria-label="Close Saved Stops and Routes" onClick={onClose}><X aria-hidden="true" /></button></header>
    {error ? <div className="v2-inline-error" role="alert"><p>{error}</p></div> : null}
    {!items && !error ? <p className="v2-search-status" role="status">Loading saved items…</p> : null}
    {items ? <div className="v2-saved-groups">
      <details open><summary>Saved Stops <span>{items.stops.length}</span></summary>{items.stops.length ? <ul>{items.stops.map(stop => <li key={stop.id}><MapPin aria-hidden="true" weight="duotone" /><div><strong>{stop.name}</strong><span>{stop.address}</span><small>{stop.type || "Saved stop"}</small></div></li>)}</ul> : <p>No saved stops yet.</p>}</details>
      <details open><summary>Saved Routes <span>{items.routes.length}</span></summary>{items.routes.length ? <ul>{items.routes.map(route => <li key={route.id}><Path aria-hidden="true" weight="duotone" /><div><strong>{route.name}</strong><span>{route.stops.length} {route.stops.length === 1 ? "stop" : "stops"}</span><small>{route.stops.map(stop => stop.name).join(" → ")}</small></div></li>)}</ul> : <p>No saved routes yet.</p>}</details>
    </div> : null}
  </section>;
}
