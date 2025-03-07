import { join } from "node:path"
import dotenv from "dotenv"
import { CONFIG_DIR } from "./fs"

dotenv.config({ path: join(CONFIG_DIR, ".env") })

if (!process.env.ANTHROPIC_API_KEY) {
	throw new Error("ANTHROPIC_API_KEY is not set")
}

export const env = {
	ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
}
