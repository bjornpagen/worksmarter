import { join } from "node:path"
import { homedir } from "node:os"
import { mkdir } from "node:fs/promises"
import { Errors } from "./errors.ts"
import { CONFIG_DIR_NAME, SCREENSHOTS_DIR_NAME } from "./constants"

// Initialize paths once
export const HOME_DIR = homedir()
export const CONFIG_DIR = join(HOME_DIR, CONFIG_DIR_NAME)
export const SCREENSHOTS_DIR = join(CONFIG_DIR, SCREENSHOTS_DIR_NAME)

/**
 * Generate a timestamped filename for a screenshot
 */
export function generateScreenshotFilename(): string {
	const now = new Date()
	const timestamp = now
		.toISOString()
		.replace(/[-:]/g, "")
		.replace("T", "_")
		.replace(/\..+/, "")

	return `screenshot_${timestamp}.png`
}

/**
 * Ensure the required directories exist, creating them if needed
 */
export async function ensureDirectoriesExist(): Promise<void> {
	// Create config directory
	const configDirResult = await Errors.try(
		mkdir(CONFIG_DIR, { recursive: true })
	)

	// Create screenshots directory
	const screenshotsDirResult = await Errors.try(
		mkdir(SCREENSHOTS_DIR, { recursive: true })
	)

	// Check if either operation resulted in fatal errors
	if (configDirResult.error && screenshotsDirResult.error) {
		throw Errors.wrap(
			configDirResult.error,
			"Failed to create required directories"
		)
	}
}
