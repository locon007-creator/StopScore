import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { savedRoutes } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const validStopTypes = new Set(["Delivery", "Pickup", "Drop & Hook", "Delivery & Pickup"]);

type RouteStop = {
  name: string;
  address: string;
  type: string;
  open: string;
  close: string;
};

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Saved Routes are temporarily unavailable.";
  if (message.includes("no such table")) return "Saved Routes are not ready yet.";
  return message;
}

function validStops(value: unknown): value is RouteStop[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(stop => (
    !!stop && typeof stop === "object" && !Array.isArray(stop)
    && typeof (stop as RouteStop).name === "string" && (stop as RouteStop).name.trim().length > 0 && (stop as RouteStop).name.length <= 160
    && typeof (stop as RouteStop).address === "string" && (stop as RouteStop).address.trim().length > 0 && (stop as RouteStop).address.length <= 400
    && typeof (stop as RouteStop).type === "string" && validStopTypes.has((stop as RouteStop).type)
    && typeof (stop as RouteStop).open === "string" && (stop as RouteStop).open.length <= 80
    && typeof (stop as RouteStop).close === "string" && (stop as RouteStop).close.length <= 80
  ));
}

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "Sign in to view Saved Routes.", savedRoutes: [] }, { status: 401 });
    const db = await getDb();
    const rows = await db.select({ id: savedRoutes.id, name: savedRoutes.name, stops: savedRoutes.stops })
      .from(savedRoutes).where(eq(savedRoutes.driverId, user.email.trim().toLowerCase()))
      .orderBy(desc(savedRoutes.updatedAt), desc(savedRoutes.id));
    const normalized = rows.flatMap(row => validStops(row.stops) ? [{ ...row, stops: row.stops }] : []);
    return Response.json({ savedRoutes: normalized });
  } catch (error) {
    return Response.json({ error: errorMessage(error), savedRoutes: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "Sign in to save a route." }, { status: 401 });
    const payload = await request.json() as { name?: unknown; stops?: unknown };
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name || name.length > 80 || !validStops(payload.stops)) return Response.json({ error: "Give this route a name and include at least one valid stop." }, { status: 400 });
    const db = await getDb();
    const now = new Date().toISOString();
    const [savedRoute] = await db.insert(savedRoutes).values({ driverId: user.email.trim().toLowerCase(), name, stops: payload.stops, createdAt: now, updatedAt: now })
      .returning({ id: savedRoutes.id, name: savedRoutes.name, stops: savedRoutes.stops });
    return Response.json({ savedRoute }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
