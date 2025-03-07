import { parseArgs } from "node:util"
import dotenv from "dotenv"
import { startCapturing } from "./capture"
import { listApps } from "./apps"
import { generateReport } from "./report"
import { Errors } from "./errors"

// Load environment variables
dotenv.config()

// Function to parse date strings (YYYY-MM-DD or MM-DD)
function parseDate(str: string): Date | null {
	const parts = str.split("-")
	if (parts.length === 3) {
		// YYYY-MM-DD
		const year = Number.parseInt(parts[0], 10)
		const month = Number.parseInt(parts[1], 10)
		const day = Number.parseInt(parts[2], 10)
		if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day))
			return null
		const date = new Date(year, month - 1, day)
		if (
			date.getFullYear() === year &&
			date.getMonth() + 1 === month &&
			date.getDate() === day
		) {
			return date
		}
		return null
	}
	if (parts.length === 2) {
		// MM-DD
		const month = Number.parseInt(parts[0], 10)
		const day = Number.parseInt(parts[1], 10)
		if (Number.isNaN(month) || Number.isNaN(day)) return null
		const currentYear = new Date().getFullYear()
		const date = new Date(currentYear, month - 1, day)
		if (date.getMonth() + 1 === month && date.getDate() === day) {
			return date
		}
		return null
	}
	return null
}

// Main CLI logic
if (Bun.argv.length < 3) {
	console.error("Usage: cmd <subcommand> [options]")
	console.error("Subcommands:")
	console.error("  daemon [--bg]         Start capturing application data")
	console.error("  apps list             List all tracked applications")
	console.error(
		"  report <date_range>   Generate a report (e.g., 2025-03-07:2025-03-14 or 3-7:3-14)"
	)
	process.exit(1)
}

const subcommand = Bun.argv[2]

try {
	switch (subcommand) {
		case "daemon": {
			const daemonArgs = parseArgs({
				args: Bun.argv.slice(3),
				options: {
					bg: { type: "boolean" }
				},
				strict: true,
				allowPositionals: false
			})
			const bg = daemonArgs.values.bg || false
			const result = Errors.trySync(() => startCapturing(bg))
			if (result.error) {
				throw Errors.wrap(result.error, "Failed to start capturing")
			}
			break
		}

		case "apps": {
			if (Bun.argv.length < 4 || Bun.argv[3] !== "list") {
				console.error("Usage: cmd apps list")
				process.exit(1)
			}
			const result = Errors.trySync(() => listApps())
			if (result.error) {
				throw Errors.wrap(result.error, "Failed to list apps")
			}
			break
		}

		case "report": {
			const reportArgs = parseArgs({
				args: Bun.argv.slice(3),
				options: {},
				strict: true,
				allowPositionals: true
			})
			if (reportArgs.positionals.length !== 1) {
				console.error("Usage: cmd report <date_range>")
				console.error(
					"Example: cmd report 2025-03-07:2025-03-14 or cmd report 3-7:3-14"
				)
				process.exit(1)
			}
			const dateRange = reportArgs.positionals[0]
			const [startStr, endStr] = dateRange.split(":")
			if (!startStr || !endStr) {
				console.error(
					"Invalid date range format. Use start:end (e.g., 3-7:3-14)"
				)
				process.exit(1)
			}
			const startDate = parseDate(startStr)
			const endDate = parseDate(endStr)
			if (!startDate || !endDate) {
				console.error("Invalid date format. Use YYYY-MM-DD or MM-DD")
				process.exit(1)
			}

			const result = Errors.trySync(() => generateReport(startDate, endDate))
			if (result.error) {
				throw Errors.wrap(result.error, "Failed to generate report")
			}
			break
		}

		default: {
			console.error(`Unknown subcommand: ${subcommand}`)
			console.error("Subcommands: daemon, apps, report")
			process.exit(1)
		}
	}
} catch (err) {
	console.error("An error occurred:", err)
	process.exit(1)
}
