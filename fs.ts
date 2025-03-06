import { join } from "node:path"
import { homedir } from "node:os"
import { mkdir } from "node:fs/promises"
import { Errors } from "./errors.ts"
import { CONFIG_DIR_NAME } from "./constants"

// Initialize paths once
export const HOME_DIR = homedir()
export const CONFIG_DIR = join(HOME_DIR, CONFIG_DIR_NAME)

/**
 * Ensure the required directories exist, creating them if needed
 */
export async function ensureDirectoriesExist(): Promise<void> {
	// Create config directory
	const configDirResult = await Errors.try(
		mkdir(CONFIG_DIR, { recursive: true })
	)
	
	if (configDirResult.error) {
		throw Errors.wrap(
			configDirResult.error,
			"Failed to create config directory"
		)
	}
}
