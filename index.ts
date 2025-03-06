import { Errors } from "./errors"
import { CAPTURE_INTERVAL_MS } from "./constants"
import { ensureDirectoriesExist } from "./fs"
import { recordSnapshotData } from "./db-operations"
import { getRunningApplications } from "./app-detection"
import dotenv from "dotenv"

/**
 * Capture app data and record it
 * Tracks window details, app sessions, and Safari tab URL
 */
export async function captureAndRecord(): Promise<void> {
	const startTime = Date.now()

	// Get window details, frontmost app, and Safari tab URL if applicable
	const runningAppsResult = await Errors.try(
		Promise.resolve(getRunningApplications())
	)
	if (runningAppsResult.error) {
		throw Errors.wrap(
			runningAppsResult.error,
			"Failed to get window details"
		)
	}
	const { windows, frontmostApp, frontmostTabUrl } = runningAppsResult.data

	// Record the data
	const recordResult = await Errors.try(
		recordSnapshotData(windows, frontmostApp, frontmostTabUrl)
	)
	if (recordResult.error) {
		throw Errors.wrap(recordResult.error, "Snapshot metadata error")
	}

	const endTime = Date.now()
	console.log(`Snapshot captured in ${endTime - startTime}ms`)
}

/**
 * Main function to start capturing app data at regular intervals
 */
export async function startCapturing(): Promise<void> {
	const dirResult = await Errors.try(ensureDirectoriesExist())
	if (dirResult.error) {
		throw Errors.wrap(dirResult.error, "Failed to ensure directories exist")
	}

	async function captureLoop() {
		const captureResult = await Errors.try(captureAndRecord())
		if (captureResult.error) {
			throw Errors.wrap(
				captureResult.error,
				"Failed to capture and record snapshot"
			)
		}

		setTimeout(captureLoop, CAPTURE_INTERVAL_MS)
	}

	captureLoop()
}

if (require.main === module) {
	dotenv.config()

	startCapturing()

	console.log(
		`WorkSmarter started. Capturing snapshots every ${CAPTURE_INTERVAL_MS / 1000} seconds.`
	)
	console.log("✓ Tracking window sizes, titles, application start times, and Safari tabs")
	console.log("Press Ctrl+C to stop.")

	process.on("SIGINT", async () => {
		console.log("Received SIGINT. Shutting down...")
		process.exit(0)
	})
}
