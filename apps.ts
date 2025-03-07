import { getDb } from "./db"
import * as schema from "./db/schema"
import { Errors } from "./errors"

/**
 * List all applications stored in the database
 */
export async function listApps(): Promise<void> {
	const db = getDb()

	const result = Errors.trySync(() => {
		return db.select().from(schema.app).all()
	})

	if (result.error) {
		throw Errors.wrap(
			result.error,
			"Failed to retrieve applications from database"
		)
	}

	console.table(result.data)
}
