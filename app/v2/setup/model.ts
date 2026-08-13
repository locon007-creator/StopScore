import {
  TRACTOR_TRAILER_TYPES,
  validateEquipment,
  type Equipment,
  type EquipmentType,
  type RouteStopInput,
  type StopType,
  type TrailerType,
} from "../domain/workday.ts";

export const EQUIPMENT_OPTIONS: ReadonlyArray<{ type: EquipmentType; label: string; description: string; image: string }> = [
  { type: "tractor", label: "Truck Tractor", description: "Tractor + trailer", image: "/assets/equipment/truck-tractor.webp" },
  { type: "bobtail", label: "Truck Bobtail", description: "Tractor only", image: "/assets/equipment/truck-bobtail.webp" },
  { type: "box_truck", label: "Box Truck", description: "Full-size box body", image: "/assets/equipment/box-truck.webp" },
  { type: "small_box_truck", label: "Small Box Truck", description: "Light-duty box truck", image: "/assets/equipment/small-box-truck.webp" },
  { type: "cargo_van", label: "Cargo Van", description: "Commercial van", image: "/assets/equipment/cargo-van.webp" },
];

export const TRAILER_OPTIONS: ReadonlyArray<{ type: TrailerType; label: string }> = [
  { type: "dry_van", label: "Dry Van" },
  { type: "reefer", label: "Reefer" },
  { type: "flatbed", label: "Flatbed" },
  { type: "step_deck", label: "Step Deck" },
  { type: "tanker", label: "Tanker" },
  { type: "other", label: "Other" },
];

export const STOP_TYPE_OPTIONS: ReadonlyArray<{ type: StopType; label: string; description: string }> = [
  { type: "delivery", label: "Delivery", description: "Unload freight at this stop" },
  { type: "pickup", label: "Pickup", description: "Pick up freight at this stop" },
  { type: "drop_hook", label: "Drop & Hook", description: "Drop one trailer and hook another" },
  { type: "delivery_pickup", label: "Delivery & Pickup", description: "Deliver and pick up freight" },
];

export type EquipmentField = "truckNumber" | "odometer" | "trailerType" | "trailerNumber";
export type EquipmentDraft = {
  type: EquipmentType | null;
  truckNumber: string;
  odometer: string;
  trailerType: TrailerType | "";
  trailerNumber: string;
};
export type SetupStage = "equipment-choice" | "trailer-choice" | "equipment-info" | "equipment-ready" | "route-search" | "stop-type" | "route-list" | "organize" | "prepare";
export type EquipmentErrors = Partial<Record<EquipmentField, string>>;
export const EQUIPMENT_FIELD_MAX_LENGTH = 80;
export type SetupState = {
  stage: SetupStage;
  equipmentDraft: EquipmentDraft;
  equipmentErrors: EquipmentErrors;
  validatedEquipment: Equipment | null;
  committedStops: RouteStopInput[];
  organizingStops: RouteStopInput[];
  routeError: string | null;
};

export type SetupAction =
  | { type: "select-equipment"; equipment: EquipmentType }
  | { type: "select-trailer"; trailerType: TrailerType }
  | { type: "change-equipment-field"; field: EquipmentField; value: string }
  | { type: "back-to-equipment" }
  | { type: "validate-equipment" }
  | { type: "confirm-equipment-ready" }
  | { type: "set-stage"; stage: SetupStage }
  | { type: "add-stop"; stop: Omit<RouteStopInput, "order"> }
  | { type: "delete-stop"; providerId: string }
  | { type: "begin-organize" }
  | { type: "move-organizing-stop"; from: number; to: number }
  | { type: "cancel-organize" }
  | { type: "commit-organize" };

const emptyEquipmentDraft = (): EquipmentDraft => ({
  type: null,
  truckNumber: "",
  odometer: "",
  trailerType: "",
  trailerNumber: "",
});

export function initialSetupState(): SetupState {
  return {
    stage: "equipment-choice",
    equipmentDraft: emptyEquipmentDraft(),
    equipmentErrors: {},
    validatedEquipment: null,
    committedStops: [],
    organizingStops: [],
    routeError: null,
  };
}

export type EquipmentValidation =
  | { ok: true; value: Equipment; errors: Record<string, never> }
  | { ok: false; errors: EquipmentErrors; focusField: EquipmentField };

export function validateEquipmentDraft(draft: EquipmentDraft): EquipmentValidation {
  const errors: EquipmentErrors = {};
  const bounded = (value: unknown, field: EquipmentField, emptyMessage: string) => {
    if (typeof value !== "string" || !value.trim()) errors[field] = emptyMessage;
    else if (value.trim().length > EQUIPMENT_FIELD_MAX_LENGTH) errors[field] = `Use ${EQUIPMENT_FIELD_MAX_LENGTH} characters or fewer.`;
  };
  bounded(draft.truckNumber, "truckNumber", "Enter the Truck #.");
  bounded(draft.odometer, "odometer", "Enter the odometer reading.");
  if (draft.type === "tractor") {
    if (!draft.trailerType) errors.trailerType = "Choose a trailer type.";
    if (draft.trailerNumber.trim().length > EQUIPMENT_FIELD_MAX_LENGTH) errors.trailerNumber = `Use ${EQUIPMENT_FIELD_MAX_LENGTH} characters or fewer.`;
  }
  const focusOrder: EquipmentField[] = ["truckNumber", "odometer", "trailerType", "trailerNumber"];
  const focusField = focusOrder.find(field => errors[field]);
  if (!draft.type) return { ok: false, errors: { truckNumber: "Choose your equipment first." }, focusField: "truckNumber" };
  if (focusField) return { ok: false, errors, focusField };

  const candidate: Record<string, unknown> = {
    type: draft.type,
    truckNumber: draft.truckNumber.trim(),
    odometer: draft.odometer.trim(),
  };
  if (draft.type === "tractor") {
    candidate.trailerType = draft.trailerType;
    if (draft.trailerNumber.trim()) candidate.trailerNumber = draft.trailerNumber.trim();
  }
  try {
    return { ok: true, value: validateEquipment(candidate), errors: {} };
  } catch {
    return { ok: false, errors: { truckNumber: "Check the equipment details and try again." }, focusField: "truckNumber" };
  }
}

const ordered = (stops: RouteStopInput[]) => stops.map((stop, order) => ({ ...stop, order }));

function move<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case "select-equipment": {
      const tractor = action.equipment === "tractor";
      return {
        ...state,
        stage: tractor ? "trailer-choice" : "equipment-info",
        equipmentDraft: {
          ...state.equipmentDraft,
          type: action.equipment,
          trailerType: tractor ? state.equipmentDraft.trailerType : "",
          trailerNumber: tractor ? state.equipmentDraft.trailerNumber : "",
        },
        equipmentErrors: {},
        validatedEquipment: null,
      };
    }
    case "select-trailer":
      return {
        ...state,
        stage: "equipment-info",
        equipmentDraft: { ...state.equipmentDraft, trailerType: action.trailerType },
        equipmentErrors: { ...state.equipmentErrors, trailerType: undefined },
        validatedEquipment: null,
      };
    case "change-equipment-field": {
      const value = action.field === "trailerType" && !TRACTOR_TRAILER_TYPES.includes(action.value as TrailerType)
        ? ""
        : action.value;
      return {
        ...state,
        equipmentDraft: { ...state.equipmentDraft, [action.field]: value },
        equipmentErrors: { ...state.equipmentErrors, [action.field]: undefined },
        validatedEquipment: null,
      };
    }
    case "back-to-equipment":
      return { ...state, stage: "equipment-choice", equipmentErrors: {} };
    case "validate-equipment": {
      const result = validateEquipmentDraft(state.equipmentDraft);
      return result.ok
        ? { ...state, stage: "equipment-ready", validatedEquipment: result.value, equipmentErrors: {} }
        : { ...state, equipmentErrors: result.errors };
    }
    case "confirm-equipment-ready":
      return state.validatedEquipment ? { ...state, stage: "route-search" } : state;
    case "set-stage":
      return { ...state, stage: action.stage, routeError: null };
    case "add-stop": {
      if (state.committedStops.some(stop => stop.providerId === action.stop.providerId)) {
        return { ...state, stage: "route-list", routeError: "This place is already on your route." };
      }
      return {
        ...state,
        stage: "route-list",
        committedStops: [...state.committedStops, { ...action.stop, order: state.committedStops.length }],
        organizingStops: [],
        routeError: null,
      };
    }
    case "delete-stop":
      return {
        ...state,
        committedStops: ordered(state.committedStops.filter(stop => stop.providerId !== action.providerId)),
        organizingStops: [],
        stage: state.committedStops.length === 1 ? "route-search" : state.stage,
      };
    case "begin-organize":
      return { ...state, stage: "organize", organizingStops: state.committedStops.map(stop => ({ ...stop })), routeError: null };
    case "move-organizing-stop":
      return { ...state, organizingStops: ordered(move(state.organizingStops, action.from, action.to)) };
    case "cancel-organize":
      return { ...state, stage: "route-list", organizingStops: [] };
    case "commit-organize":
      return { ...state, stage: "route-list", committedStops: ordered(state.organizingStops), organizingStops: [] };
  }
}
