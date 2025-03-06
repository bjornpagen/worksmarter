import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator" // Correct import for SQLite
import { CONFIG_DIR_NAME, DB_FILENAME } from "../constants"
import { homedir } from "node:os"
import { join, dirname } from "node:path"
import { mkdirSync } from "node:fs"
import { Errors } from "../errors"

let db: ReturnType<typeof drizzle> | undefined

export function getDb() {
	if (!db) {
		const dbPath = join(homedir(), CONFIG_DIR_NAME, DB_FILENAME)
		const dbDir = dirname(dbPath)

		const mkdirResult = Errors.trySync(() => {
			mkdirSync(dbDir, { recursive: true })
		})

		if (mkdirResult.error) {
			throw Errors.wrap(
				mkdirResult.error,
				"Failed to create database directory"
			)
		}

		const conn = new Database(dbPath)

		// Apply all migrations from the migrations folder
		const migrationResult = Errors.trySync(() => {
			migrate(drizzle(conn), { migrationsFolder: "./drizzle" })
		})

		if (migrationResult.error) {
			throw Errors.wrap(
				migrationResult.error,
				"Failed to apply database migrations"
			)
		}

		db = drizzle(conn)
	}
	return db
}
