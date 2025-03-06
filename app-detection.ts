import { dlopen, FFIType, CString } from "bun:ffi"
import { MIN_WINDOW_AREA } from "./constants"

/**
 * Window details including app information, size, title, and frontmost status
 */
export interface WindowDetails {
	appName: string
	bundleIdentifier: string
	windowId: number
	width: number
	height: number
	title: string
	isFrontmost: boolean
}

// Load the dynamic library for getting visible applications and windows
const lib = dlopen("./libget_visible_apps.so", {
	get_visible_windows: {
		args: [],
		returns: FFIType.ptr
	},
	get_safari_current_tab: {
		args: [],
		returns: FFIType.cstring
	},
	get_chrome_current_tab: {
		args: [],
		returns: FFIType.cstring
	},
	free_visible_windows: {
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

	const seenWindowIds = new Set<number>()
	return windowList
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => {
			const parts = line.split("|")
			if (parts.length < 8) return null // Ensure sufficient parts

			const appName = parts[0]
			const bundleIdentifier = parts[1]
			// Ignore launchTime at index 2
			const windowId = Number.parseInt(parts[3])

			if (!Number.isInteger(windowId) || seenWindowIds.has(windowId))
				return null
			seenWindowIds.add(windowId)

			const width = Number.parseInt(parts[4])
			const height = Number.parseInt(parts[5])
			const title = parts[6]
			const isFrontmost = parts[7] === "1"

			// Filter out windows with invalid dimensions, empty titles, or area below threshold
			if (
				!Number.isInteger(width) ||
				!Number.isInteger(height) ||
				width <= 0 ||
				height <= 0 ||
				title === "" ||
				width * height < MIN_WINDOW_AREA
			) {
				return null
			}

			return {
				appName,
				bundleIdentifier,
				windowId,
				width,
				height,
				title,
				isFrontmost
			}
		})
		.filter((window): window is WindowDetails => window !== null)
}

/**
 * Get the URL and title of the current Safari tab if Safari is running
 */
function getSafariCurrentTab(): { url: string | null; title: string | null } {
	const result = lib.symbols.get_safari_current_tab()
	if (!result) return { url: null, title: null }

	const parts = result.toString().split("|")
	const url = parts[0] || null
	const title = parts[1] || null

	return { url, title }
}

/**
 * Get the URL and title of the current Chrome tab if Chrome is running
 */
function getChromeCurrentTab(): { url: string | null; title: string | null } {
	const result = lib.symbols.get_chrome_current_tab()
	if (!result) return { url: null, title: null }

	const parts = result.toString().split("|")
	const url = parts[0] || null
	const title = parts[1] || null

	return { url, title }
}

/**
 * Get the list of currently visible windows with their details,
 * the frontmost application, and the current Safari or Chrome tab URL and title if applicable
 */
export function getRunningApplications(): {
	windows: WindowDetails[]
	frontmostApp: string | null
	frontmostTabUrl: string | null
	frontmostTabTitle: string | null
} {
	// Get detailed window information
	const windows = getWindowDetails()

	// Find frontmost window/app
	const frontmostWindow = windows.find((window) => window.isFrontmost)
	const frontmostApp = frontmostWindow ? frontmostWindow.bundleIdentifier : null

	// Get tab info if frontmost app is Safari or Chrome
	let frontmostTabUrl: string | null = null
	let frontmostTabTitle: string | null = null
	if (frontmostApp === "com.apple.Safari") {
		const tabInfo = getSafariCurrentTab()
		frontmostTabUrl = tabInfo.url
		frontmostTabTitle = tabInfo.title
	} else if (frontmostApp === "com.google.Chrome") {
		const tabInfo = getChromeCurrentTab()
		frontmostTabUrl = tabInfo.url
		frontmostTabTitle = tabInfo.title
	}

	return { windows, frontmostApp, frontmostTabUrl, frontmostTabTitle }
}
