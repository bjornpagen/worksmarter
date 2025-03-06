import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core"

/**
 * Schema for storing metadata about the screenshots
 */
export const screenshots = sqliteTable("screenshots", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
	file_path: text("file_path").notNull(),
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
 * Pivot table connecting screenshots to applications
 * that were open at the time of capture
 */
export const screenshot_apps = sqliteTable(
	"screenshot_apps",
	{
		screenshot_id: integer("screenshot_id")
			.references(() => screenshots.id)
			.notNull(),
		app_id: integer("app_id")
			.references(() => apps.id)
			.notNull()
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.screenshot_id, table.app_id] })
		}
	}
)

/**
 * Schema for storing AI analysis results of screenshots
 */
export const screenshot_analyses = sqliteTable("screenshot_analyses", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	screenshot_id: integer("screenshot_id")
		.references(() => screenshots.id)
		.notNull(),
	category: text("category").notNull(),
	description: text("description").notNull(),
	created_at: integer("created_at", { mode: "timestamp" }).notNull()
})
