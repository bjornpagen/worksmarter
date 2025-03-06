import { Errors } from "./errors"
import { CAPTURE_INTERVAL_MS } from "./constants"
import { ensureDirectoriesExist } from "./fs"
import { recordSnapshotData } from "./db-operations"
import { getRunningApplications } from "./app-detection"
import dotenv from "dotenv"

/**
 * Capture app data and record it
 * Tracks visible applications and frontmost application
 */
export async function captureAndRecord(): Promise<void> {
	const startTime = Date.now()

	// Get the application list and frontmost app
	const runningAppsResult = await Errors.try(
		Promise.resolve(getRunningApplications())
	)
	if (runningAppsResult.error) {
		throw Errors.wrap(
			runningAppsResult.error,
			"Failed to get running applications"
		)
	}
	const { visibleApps, frontmostApp } = runningAppsResult.data

	// Record the data
	const recordResult = await Errors.try(
		recordSnapshotData(visibleApps, frontmostApp)
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
	console.log("✓ Tracking visible applications and frontmost application")
	console.log("Press Ctrl+C to stop.")

	process.on("SIGINT", async () => {
		console.log("Received SIGINT. Shutting down...")
		process.exit(0)
	})
}
