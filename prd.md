# WorkSmarter Application Enhancement: Product Requirements Document (PRD)

This PRD outlines the enhancements to the WorkSmarter application, focusing on three key improvements: asynchronous description generation, precise snapshot timing, and app category tagging. Below, we detail the requirements, proposed solutions, specific file changes, and code snippets to ensure a clear implementation path for the lead software engineer.

---

## 1. Background Description Generation

### Objective
Shift the generation of app descriptions from a synchronous process within the snapshot loop to an asynchronous background job, preventing delays in the main loop.

### Current Behavior
- App descriptions are fetched synchronously from the Anthropic API during the `getAppId` function in `db-operations.ts`, blocking the snapshot process.

### Requirements
- Make the `description` field in the `app` table nullable.
- Insert app records with `description` as `null` initially.
- Queue a background task to fetch and update the description asynchronously.

### Proposed Solution
- Update the database schema to allow nullable descriptions.
- Modify the `getAppId` function to insert apps without descriptions and trigger a background task.
- Create a new module to manage a queue of background tasks for description generation.

### Implementation Details

#### a. Update Database Schema
**File:** `db/schema.ts`
- Change the `description` field in the `app` table to be nullable.

```typescript
export const app = sqliteTable("app", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	bundleId: text("bundle_id").notNull().unique(),
	name: text("name").notNull(),
	description: text("description") // Changed from .notNull() to nullable
})
```

- **Migration Steps:**
  - Generate a new migration: `bun db:generate`
  - Apply the migration: `bun db:migrate`

#### b. Modify `getAppId` Function
**File:** `db-operations.ts`
- Update to insert apps with `description` as `null` and queue a background task.

```typescript
import { queueDescriptionFetch } from "./background-tasks" // Import new background task module

async function getAppId(
	tx: SQLiteTransaction<
		"sync",
		void,
		Record<string, unknown>,
		ExtractTablesWithRelations<Record<string, unknown>>
	>,
	bundleIdentifier: string,
	nameProp?: string
): Promise<number> {
	// Check if the app already exists
	const existingApp = await tx
		.select({ id: schema.app.id, description: schema.app.description })
		.from(schema.app)
		.where(eq(schema.app.bundleId, bundleIdentifier))
		.limit(1)

	if (existingApp.length > 0) {
		const app = existingApp[0]
		// If description is null, queue a background task
		if (app.description === null) {
			queueDescriptionFetch(app.id, bundleIdentifier, nameProp || bundleIdentifier)
		}
		return app.id as number
	}

	const appName = nameProp || bundleIdentifier

	// Insert new app with null description
	const appInsertResult = await tx
		.insert(schema.app)
		.values({
			bundleId: bundleIdentifier,
			name: appName,
			description: null // Initially null
		})
		.returning({ id: schema.app.id })

	const appId = appInsertResult[0].id as number

	// Queue background task to fetch description
	queueDescriptionFetch(appId, bundleIdentifier, appName)

	return appId
}
```

#### c. Create Background Task Module
**File:** `background-tasks.ts` (New File)
- Implement a queue to process description fetching asynchronously.

```typescript
import { anthropic } from "./anthropic"
import { getDb } from "./db/index"
import * as schema from "./db/schema"
import { eq } from "drizzle-orm"

interface DescriptionTask {
	appId: number
	bundleIdentifier: string
	appName: string
}

const descriptionQueue: DescriptionTask[] = []
let isProcessing = false

export function queueDescriptionFetch(appId: number, bundleIdentifier: string, appName: string) {
	descriptionQueue.push({ appId, bundleIdentifier, appName })
	if (!isProcessing) {
		processQueue()
	}
}

async function processQueue() {
	if (descriptionQueue.length === 0) {
		isProcessing = false
		return
	}
	isProcessing = true
	const task = descriptionQueue.shift()!
	try {
		const messageResult = await anthropic.messages.create({
			model: "claude-3-haiku-20240307",
			max_tokens: 1024,
			messages: [
				{
					role: "user",
					content: `Provide a brief description for the application "${task.appName}" (bundle identifier: ${task.bundleIdentifier}). Respond with just the description text.`
				}
			]
		})
		const content = messageResult.content[0]
		if (content.type === "text") {
			const description = content.text
			const db = getDb()
			await db.update(schema.app).set({ description }).where(eq(schema.app.id, task.appId))
		}
	} catch (error) {
		console.error(`Failed to fetch description for app ${task.appName}:`, error)
		// Optional: Add retry logic here if desired
	}
	processQueue()
}
```

#### d. Integration
- The background task runs independently, ensuring the main snapshot loop in `index.ts` remains unblocked.

---

## 2. Precise Snapshot Timing

### Objective
Ensure snapshots occur exactly every second, eliminating drift caused by the current `setTimeout` approach.

### Current Behavior
- The `startCapturing` function in `index.ts` uses `setTimeout` with a fixed `CAPTURE_INTERVAL_MS` (1000ms), scheduling the next snapshot after the current one completes, leading to timing drift.

### Requirements
- Schedule snapshots to occur precisely every second, assuming each snapshot takes less than 1 second (typically 20-50ms).
- Use a timing mechanism that aligns with the system clock.

### Proposed Solution
- Replace the fixed-interval `setTimeout` with a dynamic delay calculated to the next second boundary.

### Implementation Details

#### a. Update `startCapturing` Function
**File:** `index.ts`
- Modify the timing logic to align snapshots with second boundaries.

```typescript
import { performance } from "node:perf_hooks"

export async function startCapturing(): Promise<void> {
	await ensureDirectoriesExist()

	async function captureLoop() {
		const startTime = performance.now()
		try {
			await captureAndRecord()
		} catch (error) {
			console.error("Error during capture and record:", error)
		}
		const endTime = performance.now()
		console.log(`Snapshot captured in ${endTime - startTime}ms`)

		// Calculate delay to the next second
		const now = Date.now()
		const nextSecond = Math.ceil(now / 1000) * 1000
		const delay = nextSecond - now

		setTimeout(captureLoop, delay)
	}

	captureLoop()
}
```

#### b. Explanation
- `Date.now()` provides the current timestamp in milliseconds.
- `Math.ceil(now / 1000) * 1000` calculates the next full second.
- The `delay` ensures the next `captureLoop` call occurs exactly at the start of the next second, maintaining a precise 1-second interval.

---

## 3. App Category Tagging

### Objective
Introduce a database structure to categorize apps, laying the foundation for future reporting features.

### Requirements
- Add a `category` table to store category names and descriptions.
- Add an `app_category` junction table to link apps to categories (many-to-many relationship).
- Prepare the schema without implementing categorization logic or reports in this iteration.

### Proposed Solution
- Define new tables in the database schema.
- Apply migrations to create these tables.

### Implementation Details

#### a. Define New Tables
**File:** `db/schema.ts`
- Add `category` and `app_category` tables.

```typescript
export const category = sqliteTable("category", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	description: text("description")
})

export const app_category = sqliteTable(
	"app_category",
	{
		app_id: integer("app_id")
			.references(() => app.id)
			.notNull(),
		category_id: integer("category_id")
			.references(() => category.id)
			.notNull()
	},
	(table) => ({
		primaryKey: [table.app_id, table.category_id] // Composite primary key
	})
)
```

#### b. Migration Steps
- Generate migration: `bun db:generate`
- Apply migration: `bun db:migrate`

#### c. Future Usage
- These tables enable linking apps (e.g., "Visual Studio Code") to categories (e.g., "coding").
- Categorization logic and reporting features will be implemented in future updates.

---

## Summary of Changes

### Files Modified
1. **db/schema.ts**
   - Made `description` nullable in `app` table.
   - Added `category` and `app_category` tables.
2. **db-operations.ts**
   - Updated `getAppId` to insert apps with `description` as `null` and queue background tasks.
3. **index.ts**
   - Adjusted `startCapturing` for precise 1-second snapshot timing.

### New Files
1. **background-tasks.ts**
   - Manages a queue for asynchronous description generation.

### Commands to Run
- **Schema Changes:**
  - `bun db:generate`
  - `bun db:migrate`
- **Build and Test:**
  - `bun build index.ts --outdir ./dist`
  - `bun run dist/index.js`

---

## Validation Checklist
- [ ] Descriptions are generated asynchronously, not blocking the snapshot loop.
- [ ] Snapshots occur exactly every second, verifiable via log timestamps.
- [ ] New `category` and `app_category` tables exist in the database after migration.
