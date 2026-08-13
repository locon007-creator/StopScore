import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Miniflare } from "miniflare";

export async function createTestD1() {
  const miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } };",
    compatibilityDate: "2026-05-22",
    d1Databases: { DB: `stopscore-v2-${randomUUID()}` },
  });
  const db = await miniflare.getD1Database("DB");
  return { db, dispose: () => miniflare.dispose() };
}

export async function migrationFiles() {
  const directory = resolve(import.meta.dirname, "../drizzle");
  return (await readdir(directory))
    .filter(file => /^\d{4}_.+\.sql$/.test(file))
    .sort()
    .map(file => resolve(directory, file));
}

export async function applyMigrations(db: Awaited<ReturnType<InstanceType<typeof Miniflare>["getD1Database"]>>, files: string[]) {
  for (const file of files) {
    const statements = (await readFile(file, "utf8"))
      .split("--> statement-breakpoint")
      .map(statement => statement.trim())
      .filter(Boolean)
      .map(statement => db.prepare(statement));
    await db.batch(statements);
  }
}
