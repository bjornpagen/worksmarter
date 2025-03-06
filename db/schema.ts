import { sqliteTable, text, integer, check } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

/**
 * Schema for storing metadata about application snapshots
 */
export const snapshot = sqliteTable("snapshot", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	timestamp: integer("timestamp", { mode: "timestamp" }).notNull()
})

/**
 * Schema for storing information about applications
 */
export const app = sqliteTable("app", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	bundleId: text("bundle_id").notNull().unique(),
	name: text("name").notNull(),
	description: text("description").notNull()
})

/**
 * Stores window-specific details per snapshot, linked directly to applications
 */
export const window = sqliteTable(
	"window",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		snapshot_id: integer("snapshot_id")
			.references(() => snapshot.id)
			.notNull(),
		app_id: integer("app_id")
			.references(() => app.id)
			.notNull(),
		width: integer("width").notNull(),
		height: integer("height").notNull(),
		title: text("title").notNull(),
		is_frontmost: integer("is_frontmost", { mode: "boolean" }).notNull(),
		tab_url: text("tab_url"),
		tab_title: text("tab_title")
	},
	(table) => ({
		titleCheck: check("title_check", sql`${table.title} != ''`)
	})
)
