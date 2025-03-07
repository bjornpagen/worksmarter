import { Errors } from "./errors"
import { CAPTURE_INTERVAL_MS } from "./constants"
import { ensureDirectoriesExist } from "./fs"
import { recordSnapshotData } from "./db-operations"
import { getRunningApplications } from "./app-detection"

/**
 * Capture app data and record it
 * Tracks window details, app sessions, and browser tab info
 */
async function captureAndRecord(): Promise<void> {
	const startTime = Date.now()
	const runningAppsResult = await Errors.try(
		Promise.resolve(getRunningApplications())
	)
	if (runningAppsResult.error) {
		throw Errors.wrap(runningAppsResult.error, "Failed to get window details")
	}
	const { windows, frontmostApp, frontmostTabUrl, frontmostTabTitle } =
		runningAppsResult.data

	const recordResult = await Errors.try(
		recordSnapshotData(
			windows,
			frontmostApp,
			frontmostTabUrl,
			frontmostTabTitle
		)
	)
	if (recordResult.error) {
		throw Errors.wrap(recordResult.error, "Snapshot metadata error")
	}

	const endTime = Date.now()
	console.log(`Snapshot captured in ${endTime - startTime}ms`)
}

/**
 * Start capturing app data at regular intervals
 * @param bg - If true, suppresses console output
 */
export async function startCapturing(bg = false): Promise<void> {
	const dirResult = await Errors.try(ensureDirectoriesExist())
	if (dirResult.error) {
		throw Errors.wrap(dirResult.error, "Failed to ensure directories exist")
	}

	async function captureLoop() {
		const captureResult = await Errors.try(captureAndRecord())
		if (captureResult.error && !bg) {
			console.error("Error during capture and record:", captureResult.error)
		}
		setTimeout(captureLoop, CAPTURE_INTERVAL_MS)
	}

	captureLoop()

	if (!bg) {
		console.log(
			`WorkSmarter started. Capturing snapshots every ${CAPTURE_INTERVAL_MS / 1000} seconds.`
		)
		console.log(
			"✓ Tracking window sizes, titles, and Safari tabs (URL and title)"
		)
		console.log("Press Ctrl+C to stop.")
	}

	process.on("SIGINT", () => {
		if (!bg) {
			console.log("Received SIGINT. Shutting down...")
		}
		process.exit(0)
	})
}
