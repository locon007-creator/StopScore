import { drizzle } from "drizzle-orm/d1";
import type { AnyD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

const cloudflareWorkersModule = "cloudflare:workers";

export async function getDb() {
  return drizzle(await getD1Database(), { schema });
}

export async function getD1Database() {
  const { env } = await import(cloudflareWorkersModule) as { env: { DB?: AnyD1Database } };
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }
  return env.DB;
}
