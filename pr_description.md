Title: 🧹 Fix type safety in structuredData test mapping

Description:
🎯 **What:** Removed the usage of `any` type in the mapping of `data['@graph']` in `src/lib/structuredData.test.ts` and correctly typed it as `{ '@type': string }`.
💡 **Why:** This avoids circumventing TypeScript's type checking for the mapped element, improving maintainability and type safety, especially when reasoning about the object's structure.
✅ **Verification:** I ran `npm install --prefix worker` followed by `npm run typecheck`, `npm run lint`, and `npm run test`, and all tests are successfully passing. Code review also returned `#Correct#`.
✨ **Result:** Improved the codebase's strictness and predictability without changing functional behavior.
