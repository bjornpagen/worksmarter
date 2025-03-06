import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core"

/**
 * Schema for storing metadata about the snapshots
 */
export const snapshots = sqliteTable("snapshots", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	timestamp: integer("timestamp", { mode: "timestamp" }).notNull()
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
 * Tracks application session instances with launch times
 */
export const app_sessions = sqliteTable("app_sessions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	app_id: integer("app_id").references(() => apps.id).notNull(),
	launch_time: integer("launch_time", { mode: "timestamp" }).notNull()
})

/**
 * Pivot table connecting snapshots to app sessions
 */
export const snapshot_app_sessions = sqliteTable(
	"snapshot_app_sessions",
	{
		snapshot_id: integer("snapshot_id")
			.references(() => snapshots.id)
			.notNull(),
		app_session_id: integer("app_session_id")
			.references(() => app_sessions.id)
			.notNull()
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.snapshot_id, table.app_session_id] })
		}
	}
)

/**
 * Stores window-specific details per snapshot
 */
export const snapshot_windows = sqliteTable("snapshot_windows", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	snapshot_id: integer("snapshot_id").references(() => snapshots.id).notNull(),
	app_session_id: integer("app_session_id").references(() => app_sessions.id).notNull(),
	width: integer("width").notNull(),
	height: integer("height").notNull(),
	title: text("title").notNull(),
	is_frontmost: integer("is_frontmost", { mode: "boolean" }).notNull(),
	tab_url: text("tab_url")
})
