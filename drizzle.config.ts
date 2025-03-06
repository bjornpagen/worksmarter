import { defineConfig } from "drizzle-kit"
import { DB_FILENAME, CONFIG_DIR_NAME } from "./constants"
import { join } from "node:path"
import { homedir } from "node:os"

const CONFIG_DIR = join(homedir(), CONFIG_DIR_NAME)
const DB_PATH = join(CONFIG_DIR, DB_FILENAME)

export default defineConfig({
	schema: "./db/schema.ts", // Path to schema definitions
	dialect: "sqlite", // SQLite dialect
	dbCredentials: {
		url: `file:${DB_PATH}` // SQLite file path
	}
})
