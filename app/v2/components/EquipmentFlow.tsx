"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Circle, Gauge, PencilSimple, Tag, Truck, Van } from "@phosphor-icons/react";
import { EQUIPMENT_FIELD_MAX_LENGTH, EQUIPMENT_OPTIONS, TRAILER_OPTIONS, validateEquipmentDraft, type EquipmentField, type SetupAction, type SetupState } from "../setup/model.ts";
import type { EquipmentType, TrailerType } from "../domain/workday.ts";

export function EquipmentFlow({ state, dispatch, onExit = () => undefined }: { state: SetupState; dispatch: (action: SetupAction) => void; onExit?: () => void }) {
  const fields = useRef<Partial<Record<EquipmentField, HTMLInputElement | HTMLSelectElement | null>>>({});
  const selectedCard = useRef<HTMLButtonElement | null>(null);
  const [selectedType, setSelectedType] = useState<EquipmentType | null>(() => state.equipmentDraft.type);
  const [selectedTrailerType, setSelectedTrailerType] = useState<TrailerType | "">(() => state.equipmentDraft.trailerType);

  useEffect(() => {
    if (state.stage === "equipment-info") {
      fields.current.truckNumber?.focus();
      return;
    }
    if (state.equipmentDraft.type) selectedCard.current?.focus();
  }, [state.stage, state.equipmentDraft.type]);

  if (state.stage === "equipment-choice") {
    const selectedOption = EQUIPMENT_OPTIONS.find(option => option.type === selectedType) ?? null;
    const canContinue = Boolean(selectedType);
    return (
      <section className="v2-flow v2-equipment-flow" aria-labelledby="equipment-title">
        <nav className="v2-equipment-nav" aria-label="Equipment navigation">
          <button type="button" aria-label="Return to Home" onClick={onExit}><ArrowLeft aria-hidden="true" weight="bold" /></button>
          <span className="v2-equipment-brand" aria-label="StopScore"><b>STOP</b><b>SCORE</b></span>
          <span aria-hidden="true" />
        </nav>
        <div className="v2-section-heading v2-equipment-heading"><h1 id="equipment-title">Choose Your Equipment</h1><p>Select the vehicle you’re driving today.</p></div>
        <p id="equipment-swipe-hint" className="v2-rail-hint">Swipe to see all equipment</p>
        <div className="v2-equipment-grid" role="group" aria-label="Equipment type" aria-describedby="equipment-swipe-hint">
          {EQUIPMENT_OPTIONS.map(option => (
            <button
              key={option.type}
              className={`v2-equipment-card${selectedType === option.type ? " selected" : ""}`}
              type="button"
              ref={node => { if (selectedType === option.type) selectedCard.current = node; }}
              aria-pressed={selectedType === option.type}
              onClick={() => {
                setSelectedType(option.type);
                if (option.type !== "tractor") setSelectedTrailerType("");
              }}
            >
              {/* Local immutable assets do not need an optimizer request. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={option.image} alt="" width={220} height={132} loading="lazy" />
              <span className="v2-equipment-copy"><strong>{option.label}</strong></span>
              <span className="v2-equipment-choice" aria-hidden="true">{selectedType === option.type ? <Check weight="bold" /> : <Circle />}</span>
            </button>
          ))}
        </div>
        <div className={`v2-equipment-dock${selectedOption ? " has-selection" : ""}`} aria-live="polite">
          <button className="v2-primary-button v2-equipment-continue" type="button" disabled={!canContinue} onClick={() => { if (selectedType) dispatch({ type: "select-equipment", equipment: selectedType }); }}>
            Continue <ArrowRight aria-hidden="true" weight="bold" />
          </button>
        </div>
      </section>
    );
  }

  if (state.stage === "trailer-choice") {
    const canContinue = Boolean(selectedTrailerType);
    return (
      <section className="v2-flow v2-trailer-screen" aria-labelledby="trailer-picker-title">
        <nav className="v2-equipment-nav v2-trailer-nav" aria-label="Trailer navigation">
          <button type="button" aria-label="Back to equipment" onClick={() => dispatch({ type: "back-to-equipment" })}><ArrowLeft aria-hidden="true" weight="bold" /></button>
          <span className="v2-equipment-brand" aria-label="StopScore"><b>STOP</b><b>SCORE</b></span>
          <span aria-hidden="true" />
        </nav>
        <div className="v2-section-heading v2-trailer-heading-primary"><h1 id="trailer-picker-title">Select Trailer Type</h1><p>Choose the type of trailer you’ll be pulling today.</p></div>
        <p id="trailer-swipe-hint" className="v2-rail-hint">Swipe to see all trailer types</p>
        <div className="v2-trailer-options" role="group" aria-label="Trailer type" aria-describedby="trailer-swipe-hint">
          {TRAILER_OPTIONS.map(option => <button key={option.type} className={`v2-trailer-option${selectedTrailerType === option.type ? " selected" : ""}`} type="button" aria-pressed={selectedTrailerType === option.type} onClick={() => setSelectedTrailerType(option.type)}><span>{option.label}</span>{selectedTrailerType === option.type ? <Check aria-hidden="true" weight="bold" /> : <Circle aria-hidden="true" />}</button>)}
        </div>
        <div className="v2-trailer-dock"><button className="v2-primary-button v2-trailer-continue" type="button" disabled={!canContinue} onClick={() => { if (selectedTrailerType) dispatch({ type: "select-trailer", trailerType: selectedTrailerType }); }}>Continue <ArrowRight aria-hidden="true" weight="bold" /></button></div>
      </section>
    );
  }

  const trailerLabel = TRAILER_OPTIONS.find(option => option.type === state.equipmentDraft.trailerType)?.label ?? "Not selected";
  const change = (field: EquipmentField, value: string) => dispatch({ type: "change-equipment-field", field, value });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = validateEquipmentDraft(state.equipmentDraft);
    dispatch({ type: "validate-equipment" });
    if (!result.ok) queueMicrotask(() => fields.current[result.focusField]?.focus());
  };
  if (state.stage === "equipment-ready" && state.validatedEquipment) {
    const equipment = state.validatedEquipment;
    return <section className="v2-flow v2-equipment-ready" aria-labelledby="equipment-ready-title">
      <button className="v2-back-link" type="button" onClick={() => dispatch({ type: "set-stage", stage: "equipment-info" })}><ArrowLeft aria-hidden="true" /><span>Equipment Information</span></button>
      <div className="v2-section-heading"><h1 id="equipment-ready-title">Equipment Ready</h1><p>Your equipment is set and ready to go.</p></div>
      <div className="v2-ready-card">
        <button className="v2-ready-edit" type="button" aria-label="Edit equipment information" onClick={() => dispatch({ type: "set-stage", stage: "equipment-info" })}><PencilSimple aria-hidden="true" /></button>
        <dl>
          <div><dt><Truck aria-hidden="true" />Truck #</dt><dd>{equipment.truckNumber}</dd></div>
          {equipment.type === "tractor" ? <div><dt><Van aria-hidden="true" />Trailer Type</dt><dd>{trailerLabel}</dd></div> : null}
          {equipment.type === "tractor" ? <div><dt><Tag aria-hidden="true" />TRL # (Optional)</dt><dd>{equipment.trailerNumber || "—"}</dd></div> : null}
          <div><dt><Gauge aria-hidden="true" />Starting Odometer</dt><dd>{equipment.odometer} MI</dd></div>
        </dl>
      </div>
      <button className="v2-primary-button v2-ready-continue" type="button" onClick={() => dispatch({ type: "confirm-equipment-ready" })}>Build Today’s Route <ArrowRight aria-hidden="true" weight="bold" /></button>
    </section>;
  }
  return (
    <section className="v2-flow v2-equipment-info" aria-labelledby="equipment-info-title">
      <button className="v2-back-link" type="button" onClick={() => dispatch({ type: "back-to-equipment" })}><ArrowLeft aria-hidden="true" /><span>Change equipment</span></button>
      <div className="v2-section-heading"><h1 id="equipment-info-title">Equipment Information</h1><p>Enter your equipment details.</p></div>
      <form className="v2-form v2-equipment-form" noValidate onSubmit={submit}>
        <label>Truck #<input ref={node => { fields.current.truckNumber = node; }} value={state.equipmentDraft.truckNumber} onChange={event => change("truckNumber", event.target.value)} aria-invalid={Boolean(state.equipmentErrors.truckNumber)} aria-describedby={state.equipmentErrors.truckNumber ? "truck-error" : undefined} maxLength={EQUIPMENT_FIELD_MAX_LENGTH} autoComplete="off" /></label>
        {state.equipmentErrors.truckNumber ? <p id="truck-error" className="v2-field-error">{state.equipmentErrors.truckNumber}</p> : null}
        <label>Starting Odometer (MI)<input ref={node => { fields.current.odometer = node; }} value={state.equipmentDraft.odometer} onChange={event => change("odometer", event.target.value)} aria-invalid={Boolean(state.equipmentErrors.odometer)} aria-describedby={state.equipmentErrors.odometer ? "odometer-error" : undefined} maxLength={EQUIPMENT_FIELD_MAX_LENGTH} inputMode="numeric" autoComplete="off" /></label>
        {state.equipmentErrors.odometer ? <p id="odometer-error" className="v2-field-error">{state.equipmentErrors.odometer}</p> : null}
        {state.equipmentDraft.type === "tractor" ? <>
          <div className="v2-trailer-summary" aria-label={`Trailer Type: ${trailerLabel}`}><span>Trailer Type</span><strong>{trailerLabel}</strong></div>
          {state.equipmentErrors.trailerType ? <p id="trailer-type-error" className="v2-field-error">{state.equipmentErrors.trailerType}</p> : null}
          <label>TRL # (Optional)<input ref={node => { fields.current.trailerNumber = node; }} value={state.equipmentDraft.trailerNumber} onChange={event => change("trailerNumber", event.target.value)} aria-invalid={Boolean(state.equipmentErrors.trailerNumber)} aria-describedby={state.equipmentErrors.trailerNumber ? "trailer-number-error" : undefined} maxLength={EQUIPMENT_FIELD_MAX_LENGTH} autoComplete="off" /></label>
          {state.equipmentErrors.trailerNumber ? <p id="trailer-number-error" className="v2-field-error">{state.equipmentErrors.trailerNumber}</p> : null}
        </> : null}
        <button className="v2-primary-button" type="submit">Continue <ArrowRight aria-hidden="true" weight="bold" /></button>
      </form>
    </section>
  );
}
