# CLAUDE.md - WorkSmarter Project Guidelines

## Project Overview
WorkSmarter is a macOS application that captures screenshots every 5 seconds and saves them to a standard system directory (typically ~/.config/worksmarter, depending on the default config path on the user's system). It uses Bun.js and is optimized for minimal CPU usage.

## Build & Run Commands
- Setup: `bun install`
- Run: `bun run worksmarter.js`

## Technology Stack
- **Runtime**: Bun.js (latest stable version)
- **Language**: JavaScript (TypeScript optional)

## Code Style Guidelines
- **Naming**: camelCase for variables/functions, descriptive names for clarity
- **Error handling**:
  - Always import the Errors namespace: `import { Errors } from './errors.ts'`
  - Never use regular try/catch blocks; always use `Errors.try` instead:
    ```typescript
    const result = await Errors.try(somePromise);

    if (result.error) {
      // Handle error case by throwing the error
      throw Errors.wrap(result.error, "Operation failed");
      // DO NOT use console.error here
    }

    const data = result.data;  // Safe to use the data now
    ```
  - When propagating errors, always use `Errors.wrap` with throw:
    ```typescript
    const result = await Errors.try(somePromise);
    if (result.error) {
      throw Errors.wrap(result.error, "Failed during screenshot capture");
    }
    ```
  - For synchronous operations, use `Errors.trySync` and always throw errors when bubbling up:
    ```typescript
    const result = Errors.trySync(() => someOperation());
    if (result.error) {
      throw Errors.wrap(result.error, "Failed during synchronous operation");
    }
    ```
  - NEVER use console.log, console.debug, or console.error in any files EXCEPT the main function of index.ts
  - Always propagate errors by throwing via Errors.wrap or new Error instead of logging
- **Asynchronous Code**: Use async/await for file system and shell operations
- **Comments**: Document key functions and complex logic
