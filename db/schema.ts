import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core"

/**
 * Schema for storing metadata about the snapshots
 */
export const snapshots = sqliteTable("snapshots", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
	frontmost_app_id: integer("frontmost_app_id").references(() => apps.id)
})

/**
 * Schema for storing information about applications
 */
export const apps = sqliteTable("apps", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	bundleId: text("bundle_id").notNull().unique(),
	name: text("name").notNull(),
	description: text("description").notNull()
})

/**
 * Pivot table connecting snapshots to applications
 * that were open at the time of capture
 */
export const snapshot_apps = sqliteTable(
	"snapshot_apps",
	{
		snapshot_id: integer("snapshot_id")
			.references(() => snapshots.id)
			.notNull(),
		app_id: integer("app_id")
			.references(() => apps.id)
			.notNull()
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.snapshot_id, table.app_id] })
		}
	}
)
