import { dlopen, FFIType, CString } from "bun:ffi"

/**
 * An app detected on screen with details about it
 */
export interface DetectedApp {
	bundleIdentifier: string
	name: string
}

// Load the dynamic library for getting visible applications
const lib = dlopen("./libget_visible_apps.so", {
	get_visible_apps: {
		args: [], // No inputs needed
		returns: FFIType.ptr // Returns a pointer
	},
	get_frontmost_app: {
		args: [], // No inputs needed
		returns: FFIType.cstring // Returns a C string directly
	},
	free_visible_apps: {
		args: [FFIType.ptr], // Takes a pointer to the string
		returns: FFIType.void // Doesn't return anything
	}
})

/**
 * Get names of applications with visible windows using native macOS API
 */
function getVisibleApplications(): string[] {
	const appListPtr = lib.symbols.get_visible_apps()
	if (!appListPtr) {
		throw new Error("Couldn't get the list of visible applications")
	}

	const appList = new CString(appListPtr)
	lib.symbols.free_visible_apps(appListPtr)

	return appList.split("\n").filter((line) => line.trim() !== "")
}

/**
 * Get the frontmost application bundle identifier
 */
function getFrontmostApp(): string | null {
	const frontmostAppId = lib.symbols.get_frontmost_app()
	if (!frontmostAppId) {
		return null
	}

	// Convert CString to JavaScript string
	const frontmostAppIdString = frontmostAppId.toString()
	return frontmostAppIdString === "" ? null : frontmostAppIdString
}

/**
 * Get the list of currently running applications with visible windows
 * and the frontmost application
 */
export function getRunningApplications(): {
	visibleApps: DetectedApp[]
	frontmostApp: string | null
} {
	const appNames = getVisibleApplications()
	const visibleApps: DetectedApp[] = appNames.map((line) => {
		const [name, bundleIdentifier] = line.split("|")
		return { name, bundleIdentifier }
	})

	const frontmostApp = getFrontmostApp()

	return { visibleApps, frontmostApp }
}
