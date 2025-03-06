import { Errors } from "./errors"
import { anthropic } from "./anthropic"
import { readFileSync } from "node:fs"
import { recordAnalysisData } from "./db-operations"

interface AnalysisResult {
	category: string
	description: string
}

/**
 * Analyze a screenshot using Claude Vision API
 * Categorizes the activity shown in the screenshot
 */
export async function analyzeScreenshot(
	screenshotId: number,
	screenshotPath: string
): Promise<void> {
	const result = await Errors.try(
		analyzeScreenshotInternal(screenshotId, screenshotPath)
	)
	if (result.error) {
		// Record the error in database rather than letting it bubble up
		await recordAnalysisData(
			screenshotId,
			"error",
			`Analysis failed: ${result.error.message}`
		)
		throw Errors.wrap(result.error, "Screenshot analysis failed")
	}
}

/**
 * Internal implementation of screenshot analysis
 */
async function analyzeScreenshotInternal(
	screenshotId: number,
	screenshotPath: string
): Promise<void> {
	// Read the screenshot file
	const imageDataResult = await Errors.trySync(() =>
		readFileSync(screenshotPath)
	)
	if (imageDataResult.error) {
		throw Errors.wrap(imageDataResult.error, "Failed to read screenshot file")
	}

	// Convert image to base64
	const base64Image = imageDataResult.data.toString("base64")

	// Call Claude Vision API to analyze the screenshot
	const messageResult = await Errors.try(
		anthropic.messages.create({
			model: "claude-3-7-sonnet-20250219",
			max_tokens: 1024,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "image",
							source: {
								type: "base64",
								media_type: "image/png",
								data: base64Image
							}
						},
						{
							type: "text",
							text: "Analyze this screenshot and categorize the activity into one of the following: coding, planning, meetings, browsing, communication, productivity, entertainment, system, other. Also, provide a brief description of what's happening on the screen. Respond with a JSON object containing 'category' and 'description' fields."
						}
					]
				},
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: "{"
						}
					]
				}
			]
		})
	)

	if (messageResult.error) {
		throw Errors.wrap(
			messageResult.error,
			"Failed to analyze screenshot with Claude Vision API"
		)
	}
	if (messageResult.data.content[0].type !== "text") {
		throw new Error("Claude Vision API response is missing required fields")
	}

	// Parse the response
	const responseText = `{${messageResult.data.content[0].text}`
	const parseResult = Errors.trySync(
		() => JSON.parse(responseText) as AnalysisResult
	)

	if (parseResult.error) {
		throw Errors.wrap(
			parseResult.error,
			"Failed to parse Claude Vision API response"
		)
	}

	const analysis = parseResult.data

	// Validate the response
	if (!analysis.category || !analysis.description) {
		throw new Error("Claude Vision API response is missing required fields")
	}

	// Record the analysis results
	const recordResult = await Errors.try(
		recordAnalysisData(screenshotId, analysis.category, analysis.description)
	)

	if (recordResult.error) {
		throw Errors.wrap(recordResult.error, "Failed to record analysis data")
	}
}
