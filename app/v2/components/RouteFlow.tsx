"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check } from "@phosphor-icons/react";
import type { WorkdayAggregate } from "../domain/workday.ts";
import { createSearchOwnership, handleModalKey, initialSwipeState, reduceSwipe, restoreModalFocus, type SwipeState } from "../setup/controllers.ts";
import { STOP_TYPE_OPTIONS, TRAILER_OPTIONS, type SetupAction, type SetupState } from "../setup/model.ts";
import type { PlaceSuggestion, PhotonSearchResult } from "../server/place-search.ts";

const stageLabels = ["Search", "Stop Type", "Route List", "Organize", "Prepare"] as const;

type ClientSearchResponse = PhotonSearchResult;

export function RouteFlow({ state, dispatch, onPrepare }: { state: SetupState; dispatch: (action: SetupAction) => void; onPrepare: () => Promise<WorkdayAggregate> }) {
  const [query, setQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [owner] = useState(() => createSearchOwnership<PlaceSuggestion>());
  const [search, setSearch] = useState(owner.snapshot());
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [swipes, setSwipes] = useState<Record<string, SwipeState>>({});
  const swipesRef = useRef<Record<string, SwipeState>>({});
  const [saveStates, setSaveStates] = useState<Record<string, "saving" | "saved" | "error">>({});
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteInvoker, setDeleteInvoker] = useState<HTMLElement | null>(null);
  const [startStatus, setStartStatus] = useState<"idle" | "starting" | "error">("idle");
  const [startError, setStartError] = useState<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const flowRoot = useRef<HTMLElement>(null);
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const confirmDelete = useRef<HTMLButtonElement>(null);

  const syncSearch = useCallback(() => setSearch(owner.snapshot()), [owner]);
  const runSearch = useCallback(async (searchQuery: string) => {
    const ticket = owner.begin();
    syncSearch();
    try {
      const response = await fetch(`/api/place-search?q=${encodeURIComponent(searchQuery)}`, { headers: { Accept: "application/json" } });
      const body = await response.json().catch(() => null) as ClientSearchResponse | null;
      if (response.status === 401) {
        owner.settle(ticket, { kind: "error", message: "Your session expired. Sign in again before searching." });
      } else if (response.status === 429 || body?.kind === "rate_limited") {
        owner.settle(ticket, { kind: "error", message: "Search is busy right now. Wait a moment, then retry." });
      } else if (response.status === 503 || body?.kind === "unavailable") {
        owner.settle(ticket, { kind: "error", message: "Place search is temporarily unavailable." });
      } else if (!response.ok || !body) {
        owner.settle(ticket, { kind: "error", message: "We couldn’t search right now." });
      } else if (body.kind === "results") {
        owner.settle(ticket, { kind: "results", items: body.suggestions });
      } else {
        owner.settle(ticket, { kind: "empty" });
      }
    } catch {
      owner.settle(ticket, { kind: "error", message: "We couldn’t search right now. Check your connection." });
    }
    syncSearch();
    setActiveSuggestion(-1);
  }, [owner, syncSearch]);

  useEffect(() => {
    if (state.stage !== "route-search" || query.trim().length < 3 || query.trim() === selectedQuery) return;
    const searchQuery = query.trim();
    const timer = globalThis.setTimeout(() => { void runSearch(searchQuery); }, 300);
    return () => globalThis.clearTimeout(timer);
  }, [query, runSearch, selectedQuery, state.stage]);

  const retrySearch = () => {
    if (query.trim().length >= 3) void runSearch(query.trim());
    requestAnimationFrame(() => searchInput.current?.focus());
  };

  const choosePlace = (place: PlaceSuggestion) => {
    owner.select(place);
    syncSearch();
    setSelectedPlace(place);
    setQuery(place.address);
    setSelectedQuery(place.address.trim());
    setActiveSuggestion(-1);
    dispatch({ type: "set-stage", stage: "stop-type" });
  };

  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!search.items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion(index => (index + 1) % search.items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion(index => index < 0 ? search.items.length - 1 : (index - 1 + search.items.length) % search.items.length);
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      choosePlace(search.items[activeSuggestion]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      owner.select(null);
      syncSearch();
      setActiveSuggestion(-1);
    }
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    requestAnimationFrame(() => {
      restoreModalFocus(deleteInvoker, flowRoot.current);
    });
  };

  useEffect(() => {
    if (deleteTarget) cancelDelete.current?.focus();
  }, [deleteTarget]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => stageHeading.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [state.stage]);

  const onDeleteDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    handleModalKey({ key: event.key, shiftKey: event.shiftKey, activeElement: document.activeElement, first: cancelDelete.current, last: confirmDelete.current, preventDefault: () => event.preventDefault(), onEscape: closeDeleteDialog });
  };

  const openDelete = (providerId: string) => {
    setDeleteInvoker(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setDeleteTarget(providerId);
  };

  const saveStop = async (stop: SetupState["committedStops"][number]) => {
    setSaveStates(current => ({ ...current, [stop.providerId]: "saving" }));
    try {
      const type = STOP_TYPE_OPTIONS.find(option => option.type === stop.type)?.label;
      const response = await fetch("/api/saved-stops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: stop.displayName, address: stop.address, type }),
      });
      if (!response.ok) throw new Error("save");
      setSaveStates(current => ({ ...current, [stop.providerId]: "saved" }));
    } catch {
      setSaveStates(current => ({ ...current, [stop.providerId]: "error" }));
    }
  };

  const updateSwipe = (providerId: string, next: SwipeState) => {
    swipesRef.current = { ...swipesRef.current, [providerId]: next };
    setSwipes(swipesRef.current);
  };
  const swipeFor = (providerId: string) => swipes[providerId] ?? initialSwipeState;
  const currentSwipeFor = (providerId: string) => swipesRef.current[providerId] ?? initialSwipeState;
  const pointerDown = (providerId: string, event: ReactPointerEvent<HTMLLIElement>) => {
    const interactive = Boolean((event.target as Element).closest("button,a,input,select,textarea,[role=button]"));
    const next = reduceSwipe(currentSwipeFor(providerId), { type: "pointer-down", pointerId: event.pointerId, x: event.clientX, y: event.clientY, interactive });
    if (next.pointerId === event.pointerId) event.currentTarget.setPointerCapture(event.pointerId);
    updateSwipe(providerId, next);
  };
  const pointerMove = (providerId: string, event: ReactPointerEvent<HTMLLIElement>) => updateSwipe(providerId, reduceSwipe(currentSwipeFor(providerId), { type: "pointer-move", pointerId: event.pointerId, x: event.clientX, y: event.clientY }));
  const pointerEnd = (providerId: string, event: ReactPointerEvent<HTMLLIElement>, type: "pointer-up" | "pointer-cancel" | "lost-capture") => {
    const next = reduceSwipe(currentSwipeFor(providerId), { type, pointerId: event.pointerId });
    updateSwipe(providerId, next);
    if (type === "pointer-up" && next.markLocalReady) {
      const stop = state.committedStops.find(item => item.providerId === providerId);
      if (stop) void saveStop(stop);
    }
  };

  const submitStart = async () => {
    setStartStatus("starting");
    setStartError(null);
    try {
      const result = await onPrepare();
      if (result.state !== "active") throw new Error("Your workday did not become active. Try again.");
    } catch (error) {
      setStartStatus("error");
      setStartError(error instanceof Error ? error.message : "We couldn’t start your workday.");
    }
  };

  const activeStage = state.stage === "route-search" ? 0 : state.stage === "stop-type" ? 1 : state.stage === "organize" ? 3 : state.stage === "prepare" ? 4 : 2;
  const stageTitleId = `route-${state.stage}-title`;
  const stageAnnouncement = `${stageLabels[activeStage]} stage.`;
  return (
    <section ref={flowRoot} tabIndex={-1} className="v2-flow v2-route-flow" aria-labelledby={stageTitleId}>
      <p className="v2-sr-status" aria-live="polite">{stageAnnouncement}</p>
      <ol className="v2-stage-list v2-route-stage-list" aria-label="Route setup progress">
        {stageLabels.map((label, index) => <li key={label} className={index === activeStage ? "active" : index < activeStage ? "complete" : ""}><span>{index < activeStage ? <Check aria-hidden="true" weight="bold" /> : index + 1}</span>{label}</li>)}
      </ol>

      {state.stage === "route-search" ? <>
        <button className="v2-back-link" type="button" onClick={() => dispatch({ type: "set-stage", stage: "equipment-ready" })}><ArrowLeft aria-hidden="true" /><span>Equipment</span></button>
        <div className="v2-section-heading"><h1 ref={stageHeading} tabIndex={-1} id={stageTitleId}>Build Today’s Route</h1><p>Search for a business or address to add a stop.</p></div>
        <form className="v2-search" role="search" onSubmit={event => { event.preventDefault(); if (query.trim().length >= 3) void runSearch(query.trim()); }}>
          <label className="v2-sr-status" htmlFor="place-query">Business or address</label>
          <div><input ref={searchInput} id="place-query" type="search" role="combobox" aria-autocomplete="list" aria-expanded={search.items.length > 0} aria-controls="place-suggestions" aria-activedescendant={activeSuggestion >= 0 ? `place-suggestion-${activeSuggestion}` : undefined} value={query} onKeyDown={onSearchKeyDown} onChange={event => { setQuery(event.target.value); setSelectedQuery(null); const ticket = owner.begin(); owner.settle(ticket, { kind: "empty" }); syncSearch(); setActiveSuggestion(-1); }} placeholder="Search business or address" autoComplete="street-address" /><button type="submit" disabled={query.trim().length < 3 || search.loading}>{search.loading ? "Searching…" : "Search"}</button></div>
        </form>
        <div className="v2-search-status" aria-live="polite" tabIndex={-1}>
          {search.error ? <div className="v2-inline-error" role="alert"><p>{search.error}</p><button type="button" className="v2-secondary-button" onClick={retrySearch}>Retry</button></div> : null}
          {!search.loading && !search.error && query.trim().length >= 3 && search.items.length === 0 ? <p>No places yet. Search a specific U.S. business or street address.</p> : null}
        </div>
        {search.items.length ? <ul id="place-suggestions" className="v2-search-results" role="listbox" aria-label="Place suggestions">{search.items.map((place, index) => <li role="none" key={place.providerId}><button id={`place-suggestion-${index}`} role="option" aria-selected={activeSuggestion === index} type="button" onPointerEnter={() => setActiveSuggestion(index)} onFocus={() => setActiveSuggestion(index)} onClick={() => choosePlace(place)}><strong>{place.displayName}</strong><span>{place.address}</span></button></li>)}</ul> : null}
        {state.committedStops.length ? <button className="v2-secondary-button" type="button" onClick={() => dispatch({ type: "set-stage", stage: "route-list" })}>Back to Route List</button> : null}
      </> : null}

      {state.stage === "stop-type" && selectedPlace ? <>
        <button className="v2-back-link" type="button" onClick={() => dispatch({ type: "set-stage", stage: "route-search" })}><ArrowLeft aria-hidden="true" /><span>Search</span></button>
        <div className="v2-section-heading"><h1 ref={stageHeading} tabIndex={-1} id={stageTitleId}>Choose Stop Type</h1><p>Select the type of stop for this location.</p></div>
        <article className="v2-selected-place"><strong>{selectedPlace.displayName}</strong><span>{selectedPlace.address}</span></article>
        <div className="v2-stop-types">{STOP_TYPE_OPTIONS.map(option => <button key={option.type} type="button" onClick={() => dispatch({ type: "add-stop", stop: { providerId: selectedPlace.providerId, displayName: selectedPlace.displayName, address: selectedPlace.address, type: option.type } })}><strong>{option.label}</strong><span>{option.description}</span></button>)}</div>
      </> : null}

      {state.stage === "route-list" ? <>
        <div className="v2-section-heading"><h1 ref={stageHeading} tabIndex={-1} id={stageTitleId}>Build Today’s Route</h1><p>Check your stops below.</p></div>
        <button className="v2-add-stop" type="button" onClick={() => dispatch({ type: "set-stage", stage: "route-search" })}>+ Add Stop</button>
        {state.routeError ? <p className="v2-field-error" role="alert">{state.routeError}</p> : null}
        <ul className="v2-route-list">{state.committedStops.map((stop, index) => {
          const swipe = swipeFor(stop.providerId);
          const label = STOP_TYPE_OPTIONS.find(option => option.type === stop.type)?.label;
          return <li key={stop.providerId} className="v2-swipe-row" onPointerDown={event => pointerDown(stop.providerId, event)} onPointerMove={event => pointerMove(stop.providerId, event)} onPointerUp={event => pointerEnd(stop.providerId, event, "pointer-up")} onPointerCancel={event => pointerEnd(stop.providerId, event, "pointer-cancel")} onLostPointerCapture={event => pointerEnd(stop.providerId, event, "lost-capture")}>
            <div className="v2-delete-reveal" aria-hidden={!swipe.revealDelete}><button type="button" tabIndex={swipe.revealDelete ? 0 : -1} onClick={() => openDelete(stop.providerId)}>Delete</button></div>
            <article style={{ transform: `translateX(${swipe.offsetX}px)` }}><span className="v2-stop-number">{index + 1}</span><div><strong>{stop.displayName}</strong><p>{stop.address}</p><small>{label}{saveStates[stop.providerId] === "saving" ? " · Saving…" : saveStates[stop.providerId] === "saved" ? " · Saved" : saveStates[stop.providerId] === "error" ? " · Save failed" : ""}</small></div><button className="v2-row-delete" type="button" onClick={() => openDelete(stop.providerId)} aria-label={`Delete ${stop.displayName}`}>Delete</button></article>
          </li>;
        })}</ul>
        <div className="v2-action-stack"><button className="v2-primary-button" type="button" onClick={() => dispatch({ type: "set-stage", stage: "prepare" })}>Prepare My Route <ArrowRight aria-hidden="true" weight="bold" /></button><button className="v2-secondary-button" type="button" onClick={() => dispatch({ type: "begin-organize" })} disabled={state.committedStops.length < 2}>Organize</button></div>
      </> : null}

      {state.stage === "organize" ? <>
        <button className="v2-back-link" type="button" onClick={() => dispatch({ type: "cancel-organize" })}><ArrowLeft aria-hidden="true" /><span>Back</span></button>
        <div className="v2-section-heading"><h1 ref={stageHeading} tabIndex={-1} id={stageTitleId}>Organize Route</h1><p>Use the arrows to reorder stops.</p></div>
        <ol className="v2-organize-list">{state.organizingStops.map((stop, index) => <li key={stop.providerId}><span>{index + 1}</span><div><strong>{stop.displayName}</strong><small>{stop.address}</small></div><div><button type="button" disabled={index === 0} onClick={() => dispatch({ type: "move-organizing-stop", from: index, to: index - 1 })} aria-label={`Move ${stop.displayName} up`}><ArrowUp aria-hidden="true" /></button><button type="button" disabled={index === state.organizingStops.length - 1} onClick={() => dispatch({ type: "move-organizing-stop", from: index, to: index + 1 })} aria-label={`Move ${stop.displayName} down`}><ArrowDown aria-hidden="true" /></button></div></li>)}</ol>
        <div className="v2-action-stack"><button className="v2-secondary-button" type="button" onClick={() => dispatch({ type: "cancel-organize" })}>Back</button><button className="v2-primary-button" type="button" onClick={() => dispatch({ type: "commit-organize" })}>Save Order</button></div>
      </> : null}

      {state.stage === "prepare" ? <>
        <button className="v2-back-link" type="button" aria-label="Return to Route List" onClick={() => dispatch({ type: "set-stage", stage: "route-list" })}><ArrowLeft aria-hidden="true" /><span>Route List</span></button>
        <div className="v2-section-heading"><p className="v2-eyebrow">Ready to go</p><h1 ref={stageHeading} tabIndex={-1} id={stageTitleId}>Preparing Today’s Route</h1><p>Check your equipment and stop order before entering Work Mode.</p></div>
        {state.validatedEquipment ? <section className="v2-prepare-summary" aria-label="Equipment summary"><header><strong>Equipment</strong><button type="button" onClick={() => dispatch({ type: "set-stage", stage: "equipment-info" })}>Edit Equipment</button></header><dl><div><dt>Truck #</dt><dd>{state.validatedEquipment.truckNumber}</dd></div><div><dt>Starting Odometer</dt><dd>{state.validatedEquipment.odometer} MI</dd></div>{state.validatedEquipment.trailerType ? <div><dt>Trailer Type</dt><dd>{TRAILER_OPTIONS.find(option => option.type === state.validatedEquipment?.trailerType)?.label}</dd></div> : null}{state.validatedEquipment.trailerNumber ? <div><dt>TRL #</dt><dd>{state.validatedEquipment.trailerNumber}</dd></div> : null}</dl></section> : null}
        <section className="v2-prepare-summary" aria-label="Route summary"><header><strong>{state.committedStops.length} {state.committedStops.length === 1 ? "Stop" : "Stops"}</strong><button type="button" onClick={() => dispatch({ type: "set-stage", stage: "route-list" })}>Edit Route</button></header></section>
        <ol className="v2-prepare-list">{state.committedStops.map(stop => <li key={stop.providerId}><span>{stop.order + 1}</span><div><strong>{stop.displayName}</strong><small>{stop.address}</small></div></li>)}</ol>
        {startError ? <p className="v2-field-error" role="alert">{startError}</p> : null}
        <button className="v2-primary-button" type="button" disabled={startStatus === "starting"} onClick={() => void submitStart()}>{startStatus === "starting" ? "Starting Work Mode…" : startStatus === "error" ? "Try Starting Again" : "Start Work Mode"}</button>
      </> : null}

      {deleteTarget ? <div className="v2-modal-backdrop" role="presentation"><div className="v2-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description" onKeyDown={onDeleteDialogKeyDown}>
        <p className="v2-eyebrow">Remove stop</p><h2 id="delete-title">Delete this stop?</h2><p id="delete-description">This removes it from your setup route. Your other stops keep their order.</p>
        <div className="v2-delete-actions delete-actions"><button ref={cancelDelete} type="button" onClick={closeDeleteDialog}>Cancel</button><button ref={confirmDelete} type="button" onClick={() => { dispatch({ type: "delete-stop", providerId: deleteTarget }); closeDeleteDialog(); }}>Delete Stop</button></div>
      </div></div> : null}
    </section>
  );
}
