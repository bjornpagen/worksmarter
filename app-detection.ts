import { dlopen, FFIType, CString } from "bun:ffi"

/**
 * Window details including app information, size, title, and frontmost status
 */
export interface WindowDetails {
	appName: string
	bundleIdentifier: string
	launchTime: number
	windowId: number
	width: number
	height: number
	title: string
	isFrontmost: boolean
}

// Load the dynamic library for getting visible applications and windows
const lib = dlopen("./libget_visible_apps.so", {
	// New functions
	get_visible_windows: {
		args: [],
		returns: FFIType.ptr
	},
	get_safari_current_tab: {
		args: [],
		returns: FFIType.cstring
	},
	free_visible_windows: {
		args: [FFIType.ptr],
		returns: FFIType.void
	},

	// Legacy functions (kept for backward compatibility)
	get_visible_apps: {
		args: [],
		returns: FFIType.ptr
	},
	get_frontmost_app: {
		args: [],
		returns: FFIType.cstring
	},
	free_visible_apps: {
		args: [FFIType.ptr],
		returns: FFIType.void
	}
})

/**
 * Get detailed information about all visible windows using native macOS API
 */
function getWindowDetails(): WindowDetails[] {
	const windowListPtr = lib.symbols.get_visible_windows()
	if (!windowListPtr) {
		throw new Error("Couldn't get the list of visible windows")
	}

	const windowList = new CString(windowListPtr)
	lib.symbols.free_visible_windows(windowListPtr)

	return windowList
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => {
			const [
				appName,
				bundleIdentifier,
				launchTime,
				windowId,
				width,
				height,
				title,
				isFrontmost
			] = line.split("|")

			return {
				appName,
				bundleIdentifier,
				launchTime: Number.parseInt(launchTime),
				windowId: Number.parseInt(windowId),
				width: Number.parseInt(width),
				height: Number.parseInt(height),
				title,
				isFrontmost: isFrontmost === "1"
			}
		})
}

/**
 * Get the URL of the current Safari tab if Safari is running
 */
function getSafariCurrentTab(): string | null {
	const url = lib.symbols.get_safari_current_tab()
	if (!url) {
		return null
	}
	return url.toString() || null
}

/**
 * Get the list of currently visible windows with their details,
 * the frontmost application, and the current Safari tab URL if applicable
 */
export function getRunningApplications(): {
	windows: WindowDetails[]
	frontmostApp: string | null
	frontmostTabUrl: string | null
} {
	// Get detailed window information
	const windows = getWindowDetails()

	// Find frontmost window/app
	const frontmostWindow = windows.find((window) => window.isFrontmost)
	const frontmostApp = frontmostWindow ? frontmostWindow.bundleIdentifier : null

	// Get Safari tab URL if Safari is the frontmost app
	let frontmostTabUrl: string | null = null
	if (frontmostApp === "com.apple.Safari") {
		frontmostTabUrl = getSafariCurrentTab()
	}

	return { windows, frontmostApp, frontmostTabUrl }
}

/**
 * @deprecated Use getRunningApplications() which provides more detailed information
 */
export interface DetectedApp {
	bundleIdentifier: string
	name: string
}
