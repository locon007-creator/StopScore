import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const savedStops = sqliteTable("saved_stops", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  driverId: text("driver_id").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  type: text("stop_type"),
  open: text("open_hours").notNull().default("—"),
  close: text("close_hours").notNull().default("—"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  index("saved_stops_driver_idx").on(table.driverId),
  uniqueIndex("saved_stops_driver_address_idx").on(table.driverId, table.address),
]);

export const savedRoutes = sqliteTable("saved_routes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  driverId: text("driver_id").notNull(),
  name: text("name").notNull(),
  stops: text("stops", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  index("saved_routes_driver_idx").on(table.driverId),
]);

export const workdays = sqliteTable("workdays", {
  id: text("id").primaryKey(),
  driverId: text("driver_id").notNull(),
  activeKey: text("active_key"),
  dayDate: text("day_date").notNull(),
  phase: text("phase").notNull(),
  status: text("status").notNull().default("active"),
  snapshot: text("snapshot", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
}, table => [
  index("workdays_driver_status_idx").on(table.driverId, table.status),
  index("workdays_driver_completed_idx").on(table.driverId, table.completedAt),
  uniqueIndex("workdays_active_key_idx").on(table.activeKey),
]);

export const driverPreferences = sqliteTable("driver_preferences", {
  driverId: text("driver_id").primaryKey(),
  navigationApp: text("navigation_app").notNull().default("google"),
  trafficLayerEnabled: integer("traffic_layer_enabled", { mode: "boolean" }).notNull().default(true),
  satelliteViewEnabled: integer("satellite_view_enabled", { mode: "boolean" }).notNull().default(false),
  anonymousExperiences: integer("anonymous_experiences", { mode: "boolean" }).notNull().default(false),
  publicDriverName: text("public_driver_name").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const v2Workdays = sqliteTable("v2_workdays", {
  id: text("id").primaryKey(),
  driverId: text("driver_id").notNull(),
  activeKey: text("active_key"),
  dayDate: text("day_date").notNull(),
  state: text("state").notNull(),
  equipmentType: text("equipment_type").notNull(),
  truckNumber: text("truck_number").notNull(),
  trailerNumber: text("trailer_number"),
  trailerType: text("trailer_type"),
  odometer: text("odometer").notNull(),
  endingOdometer: text("ending_odometer"),
  activeStopIndex: integer("active_stop_index").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
}, table => [
  uniqueIndex("v2_workdays_active_key_idx").on(table.activeKey),
  uniqueIndex("v2_workdays_id_driver_idx").on(table.id, table.driverId),
  index("v2_workdays_driver_updated_idx").on(table.driverId, table.updatedAt),
  check("v2_workdays_state_check", sql`${table.state} in ('setup', 'active', 'completed')`),
  check("v2_workdays_equipment_check", sql`${table.equipmentType} in ('tractor', 'bobtail', 'straight_truck', 'box_truck', 'small_box_truck', 'cargo_van')`),
  check("v2_workdays_trailer_check", sql`(${table.equipmentType} = 'tractor' and ${table.trailerType} in ('dry_van', 'reefer', 'flatbed', 'step_deck', 'tanker', 'other')) or (${table.equipmentType} <> 'tractor' and ${table.trailerType} is null and ${table.trailerNumber} is null)`),
  check("v2_workdays_active_stop_check", sql`${table.activeStopIndex} >= 0`),
]);

export const v2Stops = sqliteTable("v2_stops", {
  id: text("id").primaryKey(),
  workdayId: text("workday_id").notNull(),
  driverId: text("driver_id").notNull(),
  providerId: text("provider_id").notNull(),
  displayName: text("display_name").notNull(),
  address: text("address").notNull(),
  stopType: text("stop_type").notNull(),
  stopOrder: integer("stop_order").notNull(),
  state: text("state").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  foreignKey({
    columns: [table.workdayId, table.driverId],
    foreignColumns: [v2Workdays.id, v2Workdays.driverId],
    name: "v2_stops_workday_owner_fk",
  }).onDelete("cascade"),
  uniqueIndex("v2_stops_id_workday_driver_idx").on(table.id, table.workdayId, table.driverId),
  uniqueIndex("v2_stops_workday_order_idx").on(table.workdayId, table.stopOrder),
  uniqueIndex("v2_stops_workday_provider_idx").on(table.workdayId, table.providerId),
  index("v2_stops_driver_workday_idx").on(table.driverId, table.workdayId),
  check("v2_stops_provider_check", sql`(${table.providerId} glob 'osm:node:[1-9]*' and substr(${table.providerId}, length('osm:node:') + 1) not glob '*[^0-9]*') or (${table.providerId} glob 'osm:way:[1-9]*' and substr(${table.providerId}, length('osm:way:') + 1) not glob '*[^0-9]*') or (${table.providerId} glob 'osm:relation:[1-9]*' and substr(${table.providerId}, length('osm:relation:') + 1) not glob '*[^0-9]*')`),
  check("v2_stops_type_check", sql`${table.stopType} in ('delivery', 'pickup', 'drop_hook', 'delivery_pickup')`),
  check("v2_stops_order_check", sql`${table.stopOrder} >= 0`),
  check("v2_stops_state_check", sql`${table.state} in ('pending', 'navigating', 'arrived', 'departed', 'experience_published')`),
]);

export const v2StopEvents = sqliteTable("v2_stop_events", {
  id: text("id").primaryKey(),
  workdayId: text("workday_id").notNull(),
  stopId: text("stop_id").notNull(),
  driverId: text("driver_id").notNull(),
  action: text("action").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  foreignKey({
    columns: [table.stopId, table.workdayId, table.driverId],
    foreignColumns: [v2Stops.id, v2Stops.workdayId, v2Stops.driverId],
    name: "v2_stop_events_stop_owner_fk",
  }).onDelete("cascade"),
  index("v2_stop_events_workday_idx").on(table.workdayId, table.createdAt),
  check("v2_stop_events_action_check", sql`${table.action} in ('navigate', 'arrive', 'depart')`),
]);

export const v2Experiences = sqliteTable("v2_experiences", {
  id: text("id").primaryKey(),
  workdayId: text("workday_id").notNull(),
  stopId: text("stop_id").notNull(),
  driverId: text("driver_id").notNull(),
  yard: integer("yard").notNull(),
  staging: integer("staging").notNull(),
  staff: integer("staff").notNull(),
  waitingTime: integer("waiting_time").notNull(),
  bathroomAccess: integer("bathroom_access").notNull(),
  bathroomAvailable: integer("bathroom_available", { mode: "boolean" }).notNull().default(false),
  bathroomCondition: text("bathroom_condition"),
  waitingCategory: text("waiting_category").notNull(),
  comment: text("comment"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  foreignKey({
    columns: [table.stopId, table.workdayId, table.driverId],
    foreignColumns: [v2Stops.id, v2Stops.workdayId, v2Stops.driverId],
    name: "v2_experiences_stop_owner_fk",
  }).onDelete("cascade"),
  uniqueIndex("v2_experiences_stop_idx").on(table.stopId),
  check("v2_experiences_yard_check", sql`${table.yard} between 1 and 5`),
  check("v2_experiences_staging_check", sql`${table.staging} between 1 and 5`),
  check("v2_experiences_staff_check", sql`${table.staff} between 1 and 5`),
  check("v2_experiences_waiting_time_check", sql`${table.waitingTime} between 1 and 5`),
  check("v2_experiences_bathroom_check", sql`${table.bathroomAccess} between 1 and 5`),
  check("v2_experiences_bathroom_detail_check", sql`(${table.bathroomAvailable} = 0 and ${table.bathroomCondition} is null) or (${table.bathroomAvailable} = 1 and ${table.bathroomCondition} in ('clean', 'dirty', 'needs_improvement'))`),
  check("v2_experiences_waiting_category_check", sql`${table.waitingCategory} in ('quick', 'standard', 'long', 'extremely_delayed')`),
]);

export const v2Idempotency = sqliteTable("v2_idempotency", {
  driverId: text("driver_id").notNull(),
  key: text("idempotency_key").notNull(),
  operation: text("operation").notNull(),
  workdayId: text("workday_id").notNull(),
  aggregate: text("aggregate", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [
  primaryKey({ columns: [table.driverId, table.key], name: "v2_idempotency_pk" }),
  foreignKey({
    columns: [table.workdayId, table.driverId],
    foreignColumns: [v2Workdays.id, v2Workdays.driverId],
    name: "v2_idempotency_workday_owner_fk",
  }).onDelete("cascade"),
  index("v2_idempotency_workday_idx").on(table.workdayId),
]);
