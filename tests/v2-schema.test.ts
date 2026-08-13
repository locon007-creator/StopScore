import assert from "node:assert/strict";
import test from "node:test";
import { getTableName } from "drizzle-orm";
import { applyMigrations, createTestD1, migrationFiles } from "./v2-d1-test-utils.ts";

const legacyTables = ["driver_preferences", "saved_routes", "saved_stops", "workdays"];
const v2Tables = ["v2_experiences", "v2_idempotency", "v2_stop_events", "v2_stops", "v2_workdays"];

test("Drizzle exports the complete additive v2 schema without renaming legacy tables", async () => {
  const schema = await import("../db/schema.ts");

  assert.deepEqual([
    getTableName(schema.driverPreferences),
    getTableName(schema.savedRoutes),
    getTableName(schema.savedStops),
    getTableName(schema.workdays),
  ].sort(), legacyTables);
  assert.ok(schema.v2Experiences, "v2Experiences table must be exported");
  assert.ok(schema.v2Idempotency, "v2Idempotency table must be exported");
  assert.ok(schema.v2StopEvents, "v2StopEvents table must be exported");
  assert.ok(schema.v2Stops, "v2Stops table must be exported");
  assert.ok(schema.v2Workdays, "v2Workdays table must be exported");
  assert.deepEqual([
    getTableName(schema.v2Experiences),
    getTableName(schema.v2Idempotency),
    getTableName(schema.v2StopEvents),
    getTableName(schema.v2Stops),
    getTableName(schema.v2Workdays),
  ].sort(), v2Tables);
});

test("generated migration is additive and enforces ownership, ordering, and state in real D1", async t => {
  const files = await migrationFiles();
  const legacyMigrations = files.filter(file => /\/000[0-5]_/.test(file));
  const v2Migrations = files.filter(file => !legacyMigrations.includes(file));
  assert.equal(v2Migrations.length, 4, "the v2 foundation, bathroom detail, additive equipment, and additive trailer migrations must follow 0005");

  const { db, dispose } = await createTestD1();
  t.after(dispose);
  await applyMigrations(db, legacyMigrations);
  await db.prepare("INSERT INTO saved_stops (driver_id, name, address) VALUES (?, ?, ?)")
    .bind("legacy@example.com", "Legacy Receiver", "1 Old Route").run();

  await applyMigrations(db, v2Migrations.slice(0, 2));
  await db.prepare("INSERT INTO v2_workdays (id, driver_id, active_key, day_date, state, equipment_type, truck_number, odometer, active_stop_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("preserved-straight", "driver-preserved", "driver-preserved", "2026-08-10", "active", "straight_truck", "S1", "10", 0, "then", "then").run();
  await db.prepare("INSERT INTO v2_stops (id, workday_id, driver_id, provider_id, display_name, address, stop_type, stop_order, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("preserved-stop", "preserved-straight", "driver-preserved", "osm:node:77", "Preserved Dock", "77 Main St", "delivery", 0, "experience_published", "then", "then").run();
  await db.prepare("INSERT INTO v2_stop_events (id, workday_id, stop_id, driver_id, action, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind("preserved-event", "preserved-straight", "preserved-stop", "driver-preserved", "arrive", "then").run();
  await db.prepare("INSERT INTO v2_experiences (id, workday_id, stop_id, driver_id, yard, staging, staff, waiting_time, bathroom_access, bathroom_available, bathroom_condition, waiting_category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("preserved-experience", "preserved-straight", "preserved-stop", "driver-preserved", 4, 4, 4, 4, 4, 0, null, "standard", "then").run();
  await db.prepare("INSERT INTO v2_idempotency (driver_id, idempotency_key, operation, workday_id, aggregate, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind("driver-preserved", "preserved-key", "start", "preserved-straight", "{}", "then").run();
  await applyMigrations(db, v2Migrations.slice(2));
  assert.equal(await db.prepare("SELECT equipment_type FROM v2_workdays WHERE id = ?").bind("preserved-straight").first<string>("equipment_type"), "straight_truck");
  for (const table of ["v2_stops", "v2_stop_events", "v2_experiences", "v2_idempotency"]) {
    assert.equal(await db.prepare(`SELECT count(*) AS count FROM ${table} WHERE workday_id = ?`).bind("preserved-straight").first<number>("count"), 1, `${table} must survive the equipment migration`);
  }
  const experienceColumns = await db.prepare("PRAGMA table_info(v2_experiences)").all<{ name: string }>();
  assert.ok(experienceColumns.results.some((column: { name: string }) => column.name === "bathroom_available"));
  assert.ok(experienceColumns.results.some((column: { name: string }) => column.name === "bathroom_condition"));
  const tables = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
  ).all<{ name: string }>();
  assert.deepEqual(tables.results.map((row: { name: string }) => row.name), [...legacyTables, ...v2Tables].sort());
  assert.equal(await db.prepare("SELECT count(*) AS count FROM saved_stops WHERE driver_id = ?")
    .bind("legacy@example.com").first<number>("count"), 1);

  await assert.rejects(
    db.prepare("INSERT INTO v2_workdays (id, driver_id, day_date, state, equipment_type, truck_number, odometer, active_stop_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("invalid", "driver-a", "2026-08-11", "broken", "cargo_van", "V1", "1", 0, "now", "now").run(),
  );
  await db.prepare("INSERT INTO v2_workdays (id, driver_id, active_key, day_date, state, equipment_type, truck_number, odometer, active_stop_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("day-a", "driver-a", "driver-a", "2026-08-11", "active", "cargo_van", "V1", "1", 0, "now", "now").run();
  await db.prepare("INSERT INTO v2_workdays (id, driver_id, active_key, day_date, state, equipment_type, truck_number, odometer, active_stop_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("day-b", "driver-b", "driver-b", "2026-08-11", "active", "cargo_van", "V2", "2", 0, "now", "now").run();
  await db.prepare("INSERT INTO v2_workdays (id, driver_id, day_date, state, equipment_type, truck_number, odometer, active_stop_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("day-box", "driver-box", "2026-08-11", "active", "box_truck", "B1", "3", 0, "now", "now").run();
  await db.prepare("INSERT INTO v2_workdays (id, driver_id, day_date, state, equipment_type, truck_number, odometer, active_stop_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("day-small-box", "driver-small-box", "2026-08-11", "active", "small_box_truck", "SB1", "4", 0, "now", "now").run();
  await db.prepare("INSERT INTO v2_workdays (id, driver_id, active_key, day_date, state, equipment_type, truck_number, trailer_type, odometer, active_stop_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("day-tractor", "driver-tractor", "driver-tractor", "2026-08-11", "active", "tractor", "T2", "reefer", "3", 0, "now", "now").run();
  await db.prepare("INSERT INTO v2_workdays (id, driver_id, active_key, day_date, state, equipment_type, truck_number, trailer_type, odometer, active_stop_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("day-tanker", "driver-tanker", "driver-tanker", "2026-08-12", "active", "tractor", "T3", "tanker", "4", 0, "now", "now").run();

  const insertStop = "INSERT INTO v2_stops (id, workday_id, driver_id, provider_id, display_name, address, stop_type, stop_order, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  await assert.rejects(db.prepare(insertStop).bind("negative", "day-a", "driver-a", "osm:node:1", "A", "1 Main", "delivery", -1, "pending", "now", "now").run());
  await assert.rejects(db.prepare(insertStop).bind("bad-state", "day-a", "driver-a", "osm:node:2", "A", "1 Main", "delivery", 0, "broken", "now", "now").run());
  await assert.rejects(db.prepare(insertStop).bind("wrong-owner", "day-a", "driver-b", "osm:node:3", "A", "1 Main", "delivery", 0, "pending", "now", "now").run());

  await db.prepare(insertStop).bind("stop-a", "day-a", "driver-a", "osm:node:10", "A", "1 Main", "delivery", 0, "pending", "now", "now").run();
  await assert.rejects(
    db.prepare("INSERT INTO v2_experiences (id, workday_id, stop_id, driver_id, yard, staging, staff, waiting_time, bathroom_access, bathroom_available, bathroom_condition, waiting_category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("invalid-bathroom", "day-a", "stop-a", "driver-a", 3, 3, 3, 3, 3, 0, "clean", "quick", "now").run(),
  );
  for (const [index, providerId] of ["osm:node:1abc", "osm:way:9:fake", "osm:relation:1.5"].entries()) {
    await assert.rejects(
      db.prepare(insertStop).bind(`noncanonical-${index}`, "day-a", "driver-a", providerId, "Invalid", "9 Main", "pickup", index + 1, "pending", "now", "now").run(),
      providerId,
    );
  }
  await assert.rejects(db.prepare(insertStop).bind("duplicate-order", "day-a", "driver-a", "osm:node:11", "B", "2 Main", "pickup", 0, "pending", "now", "now").run());
  await assert.rejects(db.prepare(insertStop).bind("duplicate-place", "day-a", "driver-a", "osm:node:10", "C", "3 Main", "pickup", 1, "pending", "now", "now").run());
  await db.prepare(insertStop).bind("stop-b", "day-b", "driver-b", "osm:node:10", "A", "1 Main", "delivery", 0, "pending", "now", "now").run();
});
