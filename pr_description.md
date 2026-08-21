🎯 **What:** Removed a leftover `console.log` from `worker/dev-server.mjs` that was printing out a message indicating the dev server audit availability on startup.
💡 **Why:** The message is unnecessary noise during dev server startup and is generally a leftover from development. Removing it improves the code health.
✅ **Verification:** Ran `npm run build`, `npm run lint`, and `npm run typecheck` which confirmed no broken functionality or types.
✨ **Result:** The `dev-server.mjs` no longer prints the leftover output on start, providing cleaner console logs.
