import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { workdays } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const allowedPhases = new Set(["preparing", "active", "ending"]);
const allowedScreens = new Set(["home", "equipment", "equipmentInfo", "route", "prepared", "work", "experience", "summary", "homeBase"]);
const allowedResumeScreens = new Set(["equipment", "equipmentInfo", "route", "prepared", "work", "experience", "summary", "homeBase"]);
const allowedSetupOrigins = new Set(["startDay", "prepared", "work"]);
const allowedEquipment = new Set(["Truck Tractor", "Truck Bobtail", "Box Truck", "Small Box Truck", "Cargo Van"]);
const allowedStopTypes = new Set(["Delivery", "Pickup", "Drop & Hook", "Delivery & Pickup", "Delivery + Pickup"]);
const maxSnapshotBytes = 250_000;

function dayDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function validSnapshot(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  if (typeof state.dayPhase !== "string" || !allowedPhases.has(state.dayPhase)) return false;
  if (typeof state.currentScreen !== "string" || !allowedScreens.has(state.currentScreen)) return false;
  if (typeof state.resumeScreen !== "string" || !allowedResumeScreens.has(state.resumeScreen)) return false;
  if (typeof state.setupOrigin !== "string" || !allowedSetupOrigins.has(state.setupOrigin)) return false;
  if (state.equipment !== null && (typeof state.equipment !== "string" || !allowedEquipment.has(state.equipment))) return false;
  if (!["truckNo", "trailerNo", "odometer", "trailerType"].every(key => typeof state[key] === "string" && (state[key] as string).length <= 80)) return false;
  if (!Number.isInteger(state.currentStop) || (state.currentStop as number) < 0) return false;
  if (!Array.isArray(state.stops) || state.stops.length > 100) return false;
  return state.stops.every(stop => {
    if (!stop || typeof stop !== "object" || Array.isArray(stop)) return false;
    const item = stop as Record<string, unknown>;
    const optionalDropHookFieldsAreValid = ["trailerDropped", "trailerPickedUp", "referenceNumber"].every(key =>
      item[key] === undefined || (typeof item[key] === "string" && (item[key] as string).length <= 80)
    );
    return Number.isInteger(item.id)
      && typeof item.name === "string" && item.name.length <= 160
      && typeof item.address === "string" && item.address.length <= 400
      && typeof item.type === "string" && allowedStopTypes.has(item.type)
      && typeof item.open === "string" && item.open.length <= 80
      && typeof item.close === "string" && item.close.length <= 80
      && optionalDropHookFieldsAreValid;
  });
}

function normalizeSnapshot(state: Record<string, unknown>) {
  return {
    ...state,
    stops: (state.stops as Array<Record<string, unknown>>).map(stop => ({
      ...stop,
      type: stop.type === "Delivery + Pickup" ? "Delivery & Pickup" : stop.type,
    })),
  };
}

async function currentDriver() {
  const user = await getChatGPTUser();
  return user?.email.trim().toLowerCase() ?? null;
}

function workdayError(error: unknown) {
  const message = error instanceof Error ? error.message : "Your day could not be saved.";
  if (message.includes("no such table")) return "Workday storage is not ready yet.";
  return "Your day could not be saved right now.";
}

export async function GET() {
  try {
    const driverId = await currentDriver();
    if (!driverId) return Response.json({ error: "Sign in to restore your day.", workday: null }, { status: 401 });

    const db = await getDb();
    const [row] = await db
      .select({ id: workdays.id, snapshot: workdays.snapshot, updatedAt: workdays.updatedAt })
      .from(workdays)
      .where(and(eq(workdays.driverId, driverId), eq(workdays.status, "active")))
      .orderBy(desc(workdays.updatedAt))
      .limit(1);

    return Response.json({ workday: row ?? null });
  } catch (error) {
    return Response.json({ error: workdayError(error), workday: null }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const driverId = await currentDriver();
    if (!driverId) return Response.json({ error: "Sign in to save your day." }, { status: 401 });

    const payload = await request.json() as { state?: unknown };
    if (!validSnapshot(payload.state)) {
      return Response.json({ error: "The workday record is invalid." }, { status: 400 });
    }

    const normalizedState = normalizeSnapshot(payload.state);
    const serialized = JSON.stringify(normalizedState);
    if (new TextEncoder().encode(serialized).byteLength > maxSnapshotBytes) {
      return Response.json({ error: "The workday record is too large." }, { status: 413 });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const [active] = await db
      .select({ id: workdays.id })
      .from(workdays)
      .where(and(eq(workdays.driverId, driverId), eq(workdays.status, "active")))
      .limit(1);

    if (active) {
      await db.update(workdays).set({
        phase: normalizedState.dayPhase as string,
        snapshot: normalizedState,
        updatedAt: now,
      }).where(eq(workdays.id, active.id));
      return Response.json({ workday: { id: active.id, updatedAt: now } });
    }

    const id = crypto.randomUUID();
    await db.insert(workdays).values({
      id,
      driverId,
      activeKey: driverId,
      dayDate: dayDate(),
      phase: normalizedState.dayPhase as string,
      status: "active",
      snapshot: normalizedState,
      createdAt: now,
      updatedAt: now,
    });

    return Response.json({ workday: { id, updatedAt: now } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: workdayError(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const driverId = await currentDriver();
    if (!driverId) return Response.json({ error: "Sign in to finish your day." }, { status: 401 });

    const payload = await request.json() as { action?: string; state?: unknown };
    if (payload.action !== "finish" || !validSnapshot(payload.state)) {
      return Response.json({ error: "The Finish Day request is invalid." }, { status: 400 });
    }

    const normalizedState = normalizeSnapshot(payload.state);
    const db = await getDb();
    const [active] = await db
      .select({ id: workdays.id })
      .from(workdays)
      .where(and(eq(workdays.driverId, driverId), eq(workdays.status, "active")))
      .limit(1);

    if (!active) return Response.json({ error: "No active workday was found." }, { status: 404 });

    const now = new Date().toISOString();
    await db.update(workdays).set({
      activeKey: null,
      phase: "completed",
      status: "completed",
      snapshot: normalizedState,
      updatedAt: now,
      completedAt: now,
    }).where(eq(workdays.id, active.id));

    return Response.json({ archived: true, workdayId: active.id, completedAt: now });
  } catch (error) {
    return Response.json({ error: workdayError(error) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const driverId = await currentDriver();
    if (!driverId) return Response.json({ error: "Sign in to cancel your day." }, { status: 401 });

    const db = await getDb();
    const activeRuns = await db
      .select({ id: workdays.id })
      .from(workdays)
      .where(and(eq(workdays.driverId, driverId), eq(workdays.status, "active")));

    if (activeRuns.length) {
      await db.delete(workdays).where(and(eq(workdays.driverId, driverId), eq(workdays.status, "active")));
    }

    return Response.json({ cleared: true, clearedRuns: activeRuns.length });
  } catch (error) {
    return Response.json({ error: workdayError(error) }, { status: 500 });
  }
}
