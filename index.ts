import { Errors } from "./errors"
import { CAPTURE_INTERVAL_MS } from "./constants"
import { ensureDirectoriesExist, SCREENSHOTS_DIR } from "./fs"
import { takeScreenshot } from "./screenshot"
import { recordScreenshotData } from "./db-operations"
import { getRunningApplications } from "./app-detection"
import { analyzeScreenshot } from "./analysis"
import dotenv from "dotenv"

/**
 * Capture a screenshot and record its metadata
 * Now tracks frontmost application and analyzes screenshots
 */
export async function captureAndRecord(): Promise<void> {
	const startTime = Date.now()

	// Get the application list and frontmost app first
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

	// Take screenshot after getting app list
	const screenshotResult = await Errors.try(takeScreenshot())
	if (screenshotResult.error) {
		throw Errors.wrap(screenshotResult.error, "Screenshot capture error")
	}
	const screenshotPath = screenshotResult.data

	// Log time difference
	const endTime = Date.now()
	console.log(`Time between app list and screenshot: ${endTime - startTime}ms`)

	// Record the data and get screenshot ID
	const recordResult = await Errors.try(
		recordScreenshotData(screenshotPath, visibleApps, frontmostApp)
	)
	if (recordResult.error) {
		throw Errors.wrap(recordResult.error, "Screenshot metadata error")
	}
	
	// Get the screenshot ID from the result
	const screenshotId = recordResult.data
	
	// Analyze the screenshot with Claude Vision
	const analysisResult = await Errors.try(
		analyzeScreenshot(screenshotId, screenshotPath)
	)
	if (analysisResult.error) {
		console.error("Screenshot analysis error:", analysisResult.error.message)
		// Continue execution even if analysis fails
	}
}

/**
 * Main function to start capturing screenshots at regular intervals
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
				"Failed to capture and record screenshot"
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
		`WorkSmarter started. Capturing screenshots every ${CAPTURE_INTERVAL_MS / 1000} seconds.`
	)
	console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`)
	console.log("✓ Tracking frontmost application")
	console.log("✓ Analyzing screenshots with Claude Vision")
	console.log("Press Ctrl+C to stop.")

	process.on("SIGINT", async () => {
		console.log("Received SIGINT. Shutting down...")
		process.exit(0)
	})
}
