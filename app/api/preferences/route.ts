import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { driverPreferences } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

type PreferencePayload = {
  navigationApp?: unknown;
  trafficLayerEnabled?: unknown;
  satelliteViewEnabled?: unknown;
  anonymousExperiences?: unknown;
  publicDriverName?: unknown;
};

async function currentDriver() {
  const user = await getChatGPTUser();
  return user?.email.trim().toLowerCase() ?? null;
}

function normalizeName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 24);
}

export async function GET() {
  try {
    const driverId = await currentDriver();
    if (!driverId) return Response.json({ preferences: null }, { status: 401 });
    const db = await getDb();
    const [preferences] = await db.select().from(driverPreferences).where(eq(driverPreferences.driverId, driverId)).limit(1);
    return Response.json({ preferences: preferences ?? null });
  } catch {
    return Response.json({ error: "Your preferences could not be reached." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const driverId = await currentDriver();
    if (!driverId) return Response.json({ error: "Sign in to save preferences." }, { status: 401 });
    const payload = await request.json() as PreferencePayload;
    const navigationApp = payload.navigationApp === "device" ? "device" : "google";
    const trafficLayerEnabled = payload.trafficLayerEnabled !== false;
    const satelliteViewEnabled = payload.satelliteViewEnabled === true;
    const anonymousExperiences = payload.anonymousExperiences === true;
    const publicDriverName = normalizeName(payload.publicDriverName);
    if (publicDriverName && publicDriverName.length < 2) return Response.json({ error: "Driver name is too short." }, { status: 400 });
    const now = new Date().toISOString();
    const db = await getDb();
    await db.insert(driverPreferences).values({ driverId, navigationApp, trafficLayerEnabled, satelliteViewEnabled, anonymousExperiences, publicDriverName, updatedAt: now }).onConflictDoUpdate({
      target: driverPreferences.driverId,
      set: { navigationApp, trafficLayerEnabled, satelliteViewEnabled, anonymousExperiences, publicDriverName, updatedAt: now },
    });
    return Response.json({ preferences: { navigationApp, trafficLayerEnabled, satelliteViewEnabled, anonymousExperiences, publicDriverName, updatedAt: now } });
  } catch {
    return Response.json({ error: "Your preferences could not be saved." }, { status: 500 });
  }
}
