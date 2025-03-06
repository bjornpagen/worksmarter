## Product Requirements Document (PRD): Enforce Non-Null and Non-Empty `title` Field in SQL Database

### Objective
Modify the application to ensure that the `title` field in the `window` table of the SQL database is neither null nor an empty string. This change addresses two issues:
1. **Prevent Storage of Untitled Apps**: We do not want to store applications or windows with no title (null or empty string) in the database, as they provide little value for tracking purposes.
2. **Exclude Safari Tab Bar Windows**: When capturing Safari windows, the tab bar is included as a separate window with an empty title (e.g., the first row in the sample data: `118 | 7 | 14 | 1512 | 96 | | 1`). We only care about the webview (e.g., the second row with a proper title and URL), and storing the tab bar is redundant. Instead of silently ignoring these cases, we will throw an error to facilitate debugging.

### Requirements
- **Database Constraint**: Update the database schema to enforce that the `title` field is not null and not an empty string.
- **Application Logic**: Validate window titles before insertion, throwing an error if a title is empty, to catch issues like the Safari tab bar window early.
- **Error Handling**: Ensure errors are logged and the application continues running, rather than crashing, to allow ongoing debugging.
- **Migration**: Apply the schema change to the existing database via a migration script.

### Sample Data Context
The following sample data illustrates the issue:
```
118 | 7 | 14 | 1512 | 96 | | 1
119 | 7 | 14 | 1512 | 945 | db-mapping-generator/sql-parse/tsql.ts at main · bjornpagen/db-mapping-generator | 1 | https://github.com/bjornpagen/db-mapping-generator/blob/main/sql-parse/tsql.ts | db-mapping-generator/sql-parse/tsql.ts at main · bjornpagen/db-mapping-generator
```
- Row 1: Likely a Safari tab bar (empty title, small height of 96px, frontmost).
- Row 2: The actual webview with a meaningful title and URL.

We aim to prevent storing Row 1 by throwing an error when an empty title is detected.

### Files Requiring Changes
Below is a comprehensive list of files that need modifications, along with detailed explanations of the changes.

#### 1. `db/schema.ts`
**Purpose**: Define the database schema and add a constraint to enforce that `title` is not an empty string (it’s already `notNull()`).

**Current Code**:
```typescript
export const window = sqliteTable("window", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    snapshot_id: integer("snapshot_id").references(() => snapshot.id).notNull(),
    app_id: integer("app_id").references(() => app.id).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    title: text("title").notNull(),
    is_frontmost: integer("is_frontmost", { mode: "boolean" }).notNull(),
    tab_url: text("tab_url"),
    tab_title: text("tab_title")
});
```

**Changes Needed**:
- The `title` field is already `notNull()`, preventing null values.
- Add a check constraint to prevent empty strings (`title != ''`) using Drizzle ORM’s SQLite support.
- Define the constraint in the table’s constraints object.

**Updated Code**:
```typescript
import { sqliteTable, text, integer, check, sql } from "drizzle-orm/sqlite-core";

export const window = sqliteTable("window", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    snapshot_id: integer("snapshot_id")
        .references(() => snapshot.id)
        .notNull(),
    app_id: integer("app_id")
        .references(() => app.id)
        .notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    title: text("title").notNull(),
    is_frontmost: integer("is_frontmost", { mode: "boolean" }).notNull(),
    tab_url: text("tab_url"),
    tab_title: text("tab_title")
}, (table) => ({
    titleCheck: check("title_check", sql`${table.title} != ''`)
}));
```

**Explanation**:
- The `check` constraint named `title_check` ensures `title` is not an empty string.
- This enforces the requirement at the database level, rejecting any insert attempts with `title = ''`.

#### 2. `app-detection.ts`
**Purpose**: Detect windows and throw an error if a window has an empty title, preventing such entries from reaching the database.

**Current Code** (Relevant Section):
```typescript
function getWindowDetails(): WindowDetails[] {
    const windowListPtr = lib.symbols.get_visible_windows();
    // ... pointer handling ...
    const windowList = new CString(windowListPtr);
    lib.symbols.free_visible_windows(windowListPtr);

    const seenWindowIds = new Set<number>();
    return windowList
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => {
            const parts = line.split("|");
            const appName = parts[0];
            const bundleIdentifier = parts[1];
            const windowId = Number.parseInt(parts[3]);
            if (seenWindowIds.has(windowId)) return null;
            seenWindowIds.add(windowId);
            const width = Number.parseInt(parts[4]);
            const height = Number.parseInt(parts[5]);
            const title = parts[6];
            const isFrontmost = parts[7] === "1";
            return {
                appName,
                bundleIdentifier,
                windowId,
                width,
                height,
                title,
                isFrontmost
            };
        })
        .filter((window): window is WindowDetails => window !== null);
}
```

**Changes Needed**:
- Add a check within the `map` function to throw an error if `title` is an empty string.
- Include relevant window details in the error message for debugging.

**Updated Code** (Relevant Section):
```typescript
function getWindowDetails(): WindowDetails[] {
    const windowListPtr = lib.symbols.get_visible_windows();
    if (!windowListPtr) {
        throw new Error("Couldn't get the list of visible windows");
    }

    const windowList = new CString(windowListPtr);
    lib.symbols.free_visible_windows(windowListPtr);

    const seenWindowIds = new Set<number>();
    return windowList
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => {
            const parts = line.split("|");
            const appName = parts[0];
            const bundleIdentifier = parts[1];
            const windowId = Number.parseInt(parts[3]);
            if (seenWindowIds.has(windowId)) return null;
            seenWindowIds.add(windowId);
            const width = Number.parseInt(parts[4]);
            const height = Number.parseInt(parts[5]);
            const title = parts[6];
            const isFrontmost = parts[7] === "1";

            if (title === "") {
                throw new Error(
                    `Window with empty title detected: appName=${appName}, bundleIdentifier=${bundleIdentifier}, windowId=${windowId}, width=${width}, height=${height}, isFrontmost=${isFrontmost}`
                );
            }

            return {
                appName,
                bundleIdentifier,
                windowId,
                width,
                height,
                title,
                isFrontmost
            };
        })
        .filter((window): window is WindowDetails => window !== null);
}
```

**Explanation**:
- The error is thrown as soon as an empty title is detected, halting processing of that window list and propagating the error up.
- The error message includes all available window details, aiding in debugging (e.g., identifying the Safari tab bar by its small height).

#### 3. `index.ts`
**Purpose**: Modify error handling in the capture loop to log errors (e.g., empty title errors) and continue running, rather than exiting.

**Current Code** (Relevant Section):
```typescript
async function captureLoop() {
    const captureResult = await Errors.try(captureAndRecord());
    if (captureResult.error) {
        throw Errors.wrap(
            captureResult.error,
            "Failed to capture and record snapshot"
        );
    }

    setTimeout(captureLoop, CAPTURE_INTERVAL_MS);
}
```

**Changes Needed**:
- Catch errors from `captureAndRecord()` and log them, then proceed to the next iteration.
- Remove the re-throwing of errors to keep the process alive.

**Updated Code** (Relevant Section):
```typescript
async function captureLoop() {
    try {
        await captureAndRecord();
    } catch (error) {
        console.error("Error during capture and record:", error);
    }

    setTimeout(captureLoop, CAPTURE_INTERVAL_MS);
}
```

**Explanation**:
- Wrapping `captureAndRecord()` in a `try-catch` block catches any errors (e.g., from `getWindowDetails`).
- Logging the error ensures visibility for debugging, while continuing the loop meets the requirement of not dropping silently and allows the application to keep running.

### Additional Steps
#### Database Migration
- **Purpose**: Apply the schema change to the existing database.
- **Process**:
  1. Update `db/schema.ts` as described.
  2. Run `bun db:generate` to create a migration script in the `drizzle` folder.
  3. Run `bun db:migrate` to apply the migration to the SQLite database.
- **Note**: Ensure no existing rows have empty `title` values before applying the migration, or handle them (e.g., by updating or deleting) to avoid constraint violations.

### Verification
- **Test Case 1**: Simulate a window with an empty title (e.g., modify `get_visible_apps.m` output temporarily). Verify that an error is thrown in `app-detection.ts` and logged in `index.ts`, and that the process continues.
- **Test Case 2**: Run with Safari open and confirm that tab bar windows trigger an error, while webview windows are processed correctly.
- **Test Case 3**: Check the database schema post-migration to confirm the `title_check` constraint is applied.

### Notes
- **Safari Tab Bar**: The current approach throws an error for tab bar windows, allowing debugging. If we later decide to filter them out silently, we could modify `getWindowDetails` or `get_visible_apps.m` to exclude windows based on criteria like height (e.g., `height < 100`).
- **Redundancy**: The check in `app-detection.ts` prevents empty titles from reaching the database, while the schema constraint acts as a failsafe. Both are included for robustness.

### Summary of Changes
| **File**            | **Change Description**                                                                 |
|---------------------|---------------------------------------------------------------------------------------|
| `db/schema.ts`      | Add `check` constraint to `window` table: `title != ''`.                              |
| `app-detection.ts`  | Throw an error in `getWindowDetails` if `title === ""`, with detailed error message.  |
| `index.ts`          | Update `captureLoop` to catch, log, and continue on errors from `captureAndRecord`.   |
