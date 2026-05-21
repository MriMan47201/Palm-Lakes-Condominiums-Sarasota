import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const propertiesTable = pgTable("plc_properties", {
  id: serial("id").primaryKey(),
  parcelId: text("parcel_id").notNull(),
  address: text("address").notNull(),
  ownerName: text("owner_name").notNull(),
  mailingAddress: text("mailing_address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  landValue: text("land_value"),
  totalValue: text("total_value"),
  lotNumber: text("lot_number"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const syncLogTable = pgTable("plc_sync_log", {
  id: serial("id").primaryKey(),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  count: integer("count").notNull().default(0),
  success: text("success").notNull().default("true"),
  message: text("message"),
});

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({ id: true, updatedAt: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof propertiesTable.$inferSelect;
export type SyncLog = typeof syncLogTable.$inferSelect;
