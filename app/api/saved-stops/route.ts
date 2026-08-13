import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { savedStops } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const validStopTypes = new Set(["Delivery", "Pickup", "Drop & Hook", "Delivery & Pickup"]);

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Saved Stops are temporarily unavailable.";
  if (message.includes("no such table")) return "Saved Stops are not ready yet.";
  return message;
}

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "Sign in to view Saved Stops.", savedStops: [] }, { status: 401 });
    const driverId = user.email.trim().toLowerCase();
    const db = await getDb();
    const rows = await db
      .select({
        id: savedStops.id,
        name: savedStops.name,
        address: savedStops.address,
        type: savedStops.type,
        open: savedStops.open,
        close: savedStops.close,
      })
      .from(savedStops)
      .where(eq(savedStops.driverId, driverId))
      .orderBy(desc(savedStops.createdAt), desc(savedStops.id));

    return Response.json({ savedStops: rows });
  } catch (error) {
    return Response.json({ error: errorMessage(error), savedStops: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "Sign in to save this stop." }, { status: 401 });
    const driverId = user.email.trim().toLowerCase();
    const payload = await request.json() as { name?: string; address?: string; type?: string; open?: string; close?: string };
    const name = payload.name?.trim() ?? "";
    const address = payload.address?.trim() ?? "";
    const type = payload.type && validStopTypes.has(payload.type) ? payload.type : null;

    if (!name || !address) {
      return Response.json({ error: "Business name and address are required." }, { status: 400 });
    }
    if (name.length > 160 || address.length > 400) {
      return Response.json({ error: "This stop name or address is too long." }, { status: 400 });
    }

    const db = await getDb();
    const [existing] = await db
      .select({
        id: savedStops.id,
        name: savedStops.name,
        address: savedStops.address,
        type: savedStops.type,
        open: savedStops.open,
        close: savedStops.close,
      })
      .from(savedStops)
      .where(and(eq(savedStops.driverId, driverId), eq(savedStops.address, address)))
      .limit(1);

    if (existing) {
      if (!existing.type && type) {
        const [updated] = await db.update(savedStops)
          .set({ type })
          .where(and(eq(savedStops.id, existing.id), eq(savedStops.driverId, driverId)))
          .returning({ id: savedStops.id, name: savedStops.name, address: savedStops.address, type: savedStops.type, open: savedStops.open, close: savedStops.close });
        return Response.json({ savedStop: updated ?? { ...existing, type }, alreadySaved: true });
      }
      return Response.json({ savedStop: existing, alreadySaved: true });
    }

    const [savedStop] = await db.insert(savedStops).values({
      driverId,
      name,
      address,
      type,
      open: payload.open?.trim() || "—",
      close: payload.close?.trim() || "—",
    }).returning({
      id: savedStops.id,
      name: savedStops.name,
      address: savedStops.address,
      type: savedStops.type,
      open: savedStops.open,
      close: savedStops.close,
    });

    return Response.json({ savedStop }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "Sign in to remove a saved stop." }, { status: 401 });
    const driverId = user.email.trim().toLowerCase();
    const rawId = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Saved stop not found." }, { status: 400 });

    const db = await getDb();
    const deleted = await db.delete(savedStops)
      .where(and(eq(savedStops.id, id), eq(savedStops.driverId, driverId)))
      .returning({ id: savedStops.id });

    if (!deleted.length) return Response.json({ error: "Saved stop not found." }, { status: 404 });
    return Response.json({ removedId: deleted[0].id });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
