import { $ } from "bun"
import { join } from "node:path"
import { Errors } from "./errors.ts"
import { SCREENSHOTS_DIR, generateScreenshotFilename } from "./fs"

/**
 * Take a screenshot and save it to the screenshots directory
 * Returns the path to the saved screenshot
 */
export async function takeScreenshot(): Promise<string> {
	const filename = generateScreenshotFilename()
	const filepath = join(SCREENSHOTS_DIR, filename)

	// Use macOS screencapture tool to take a screenshot
	const result = await Errors.try(
		$`screencapture -x -t png ${filepath}`.quiet()
	)
	if (result.error) {
		throw Errors.wrap(result.error, "Failed to capture screenshot")
	}

	return filepath
}
