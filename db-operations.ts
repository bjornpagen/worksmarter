import { Errors } from "./errors.ts"
import { getDb } from "./db/index"
import * as schema from "./db/schema"
import { eq } from "drizzle-orm"
import type { DetectedApp } from "./app-detection"
import { anthropic } from "./anthropic.ts"
import type { SQLiteTransaction } from "drizzle-orm/sqlite-core"
import type { ExtractTablesWithRelations } from "drizzle-orm"

/**
 * Gets app ID from database or creates new app entry if needed
 */
async function getAppId(
	tx: SQLiteTransaction<
		"sync",
		void,
		Record<string, unknown>,
		ExtractTablesWithRelations<Record<string, unknown>>
	>,
	bundleIdentifier: string,
	nameProp?: string
): Promise<number> {
	// Check if the app already exists in the database by bundle identifier
	const existingApp = await tx
		.select({ id: schema.apps.id })
		.from(schema.apps)
		.where(eq(schema.apps.bundleId, bundleIdentifier))
		.limit(1)

	if (existingApp.length > 0) {
		// App exists, use its ID
		return existingApp[0].id as number
	}

	const appName = nameProp || bundleIdentifier // Use bundle ID as name if name not provided

	// App doesn't exist, fetch description from Claude
	const messageResult = await Errors.try(
		anthropic.messages.create({
			model: "claude-3-7-sonnet-latest",
			max_tokens: 1024,
			messages: [
				{
					role: "user",
					content: `Provide a brief description for the application "${appName}" (bundle identifier: ${bundleIdentifier}). Respond with just the description text.`
				}
			]
		})
	)
	if (messageResult.error) {
		throw Errors.wrap(
			messageResult.error,
			`Failed to get description from Anthropic API for app: ${appName}`
		)
	}

	const content = messageResult.data.content[0]
	if (content.type !== "text") {
		throw new Error(
			`Unexpected content type returned from Anthropic API for app: ${appName}`
		)
	}
	const description = content.text

	// Handle concurrent app insertions by checking again if app exists
	// before attempting to insert (in case another process inserted it)
	const appInsertResult = await Errors.try(
		tx
			.insert(schema.apps)
			.values({
				bundleId: bundleIdentifier,
				name: appName,
				description: description
			})
			.returning({ id: schema.apps.id })
	)
	if (appInsertResult.error) {
		// If there's an error (likely due to unique constraint violation),
		// check one more time if the app now exists
		const retryExistingAppResult = await Errors.try(
			tx
				.select({ id: schema.apps.id })
				.from(schema.apps)
				.where(eq(schema.apps.bundleId, bundleIdentifier))
				.limit(1)
		)

		if (
			retryExistingAppResult.error ||
			retryExistingAppResult.data.length === 0
		) {
			throw Errors.wrap(
				appInsertResult.error,
				`Failed to insert app ${appName}`
			)
		}

		// App now exists (was inserted by another process)
		return retryExistingAppResult.data[0].id as number
	}
	return appInsertResult.data[0].id as number
}

/**
 * Record snapshot and application data in the database
 * Includes frontmost app tracking
 */
export async function recordSnapshotData(
	detectedApps: DetectedApp[],
	frontmostApp: string | null
): Promise<number> {
	const db = getDb()
	const transactionResult = await Errors.try(
		db.transaction(async (tx) => {
			const now = new Date()

			// Get frontmost app ID if applicable
			let frontmostAppId: number | null = null
			if (frontmostApp) {
				// Find app by bundleIdentifier and get its ID
				// Find matching app in detectedApps array to get the name
				const matchingApp = detectedApps.find(
					(app) => app.bundleIdentifier === frontmostApp
				)
				frontmostAppId = await getAppId(tx, frontmostApp, matchingApp?.name)
			}

			// Insert snapshot record with frontmost app ID
			const snapshotInsert = await tx
				.insert(schema.snapshots)
				.values({
					timestamp: now,
					frontmost_app_id: frontmostAppId
				})
				.returning({ id: schema.snapshots.id })

			const snapshotId = snapshotInsert[0].id as number

			// Process each detected application
			for (const app of detectedApps) {
				// Get or create the app ID
				const appId = await getAppId(tx, app.bundleIdentifier, app.name)

				// Create relationship between snapshot and app
				await tx.insert(schema.snapshot_apps).values({
					snapshot_id: snapshotId,
					app_id: appId
				})
			}

			return snapshotId
		})
	)
	if (transactionResult.error) {
		throw Errors.wrap(
			transactionResult.error,
			"Failed to record snapshot data in transaction"
		)
	}

	return transactionResult.data
}
