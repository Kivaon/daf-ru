import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  tractate: text("tractate").notNull(), ref: text("ref").notNull(),
  title: text("title").notNull(), translation: text("translation").notNull(), explanation: text("explanation").notNull(),
  unitRef: text("unit_ref"), partsJson: text("parts_json").notNull().default("[]"),
  rashiJson: text("rashi_json").notNull().default("[]"), tosafotJson: text("tosafot_json").notNull().default("[]"),
  provider: text("provider").notNull(), authorUserId: text("author_user_id").notNull(),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("articles_tractate_ref_unique").on(table.tractate, table.ref)]);
