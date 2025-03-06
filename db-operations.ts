import { Errors } from "./errors.ts"
import { getDb } from "./db/index"
import * as schema from "./db/schema"
import { eq, and, gte, lte } from "drizzle-orm"
import type { WindowDetails } from "./app-detection"
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
 * Gets or creates an app session for the given app ID and launch time
 */
async function getAppSessionId(
	tx: SQLiteTransaction<
		"sync",
		void,
		Record<string, unknown>,
		ExtractTablesWithRelations<Record<string, unknown>>
	>,
	appId: number,
	launchTime: number
): Promise<number> {
	// Look for an existing session within a reasonable time window (10 seconds)
	// This helps prevent duplicate sessions due to small timestamp variations
	const timeWindow = 10
	const existingSession = await tx
		.select({ id: schema.app_sessions.id })
		.from(schema.app_sessions)
		.where(
			and(
				eq(schema.app_sessions.app_id, appId),
				// Launch time should be within timeWindow seconds of the stored time
				// This is a simplification - in a production system you might want
				// a more sophisticated approach to session tracking
				gte(
					schema.app_sessions.launch_time,
					new Date((launchTime - timeWindow) * 1000)
				),
				lte(
					schema.app_sessions.launch_time,
					new Date((launchTime + timeWindow) * 1000)
				)
			)
		)
		.limit(1)

	if (existingSession.length > 0) {
		return existingSession[0].id as number
	}

	// Create a new session
	const sessionInsertResult = await Errors.try(
		tx
			.insert(schema.app_sessions)
			.values({
				app_id: appId,
				launch_time: new Date(launchTime * 1000) // Convert Unix timestamp to Date
			})
			.returning({ id: schema.app_sessions.id })
	)

	if (sessionInsertResult.error) {
		throw Errors.wrap(
			sessionInsertResult.error,
			`Failed to insert app session for app ID ${appId}`
		)
	}

	return sessionInsertResult.data[0].id as number
}

/**
 * Record snapshot and application data in the database
 * Includes window details, app sessions, and Safari tab URLs
 */
export async function recordSnapshotData(
	windows: WindowDetails[],
	frontmostApp: string | null,
	frontmostTabUrl: string | null
): Promise<number> {
	const db = getDb()
	const transactionResult = await Errors.try(
		db.transaction(async (tx) => {
			const now = new Date()

			// Insert snapshot record
			const snapshotInsert = await tx
				.insert(schema.snapshots)
				.values({
					timestamp: now
				})
				.returning({ id: schema.snapshots.id })

			const snapshotId = snapshotInsert[0].id as number

			// Group windows by app to avoid duplicate sessions
			const appMap = new Map<
				string,
				{
					name: string
					launchTime: number
					windows: WindowDetails[]
				}
			>()

			for (const window of windows) {
				const key = window.bundleIdentifier
				if (!appMap.has(key)) {
					appMap.set(key, {
						name: window.appName,
						launchTime: window.launchTime,
						windows: []
					})
				}
				const appEntry = appMap.get(key)
				if (appEntry) {
					appEntry.windows.push(window)
				}
			}

			// Process each application
			for (const [
				bundleId,
				{ name, launchTime, windows }
			] of appMap.entries()) {
				// Get or create the app ID
				const appId = await getAppId(tx, bundleId, name)

				// Get or create app session
				const appSessionId = await getAppSessionId(tx, appId, launchTime)

				// Link session to snapshot
				await tx.insert(schema.snapshot_app_sessions).values({
					snapshot_id: snapshotId,
					app_session_id: appSessionId
				})

				// Record each window for this app
				for (const window of windows) {
					// Determine if this window should have a tab URL
					const isActiveSafariWindow =
						window.isFrontmost &&
						window.bundleIdentifier === "com.apple.Safari" &&
						Boolean(frontmostTabUrl) &&
						frontmostApp === "com.apple.Safari"

					await tx.insert(schema.snapshot_windows).values({
						snapshot_id: snapshotId,
						app_session_id: appSessionId,
						width: window.width,
						height: window.height,
						title: window.title,
						is_frontmost: window.isFrontmost,
						tab_url: isActiveSafariWindow ? frontmostTabUrl : null
					})
				}
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
