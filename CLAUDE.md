# Komatál

- Every new feature or behaviour change must be covered by tests where applicable: unit tests (`npm test`) for logic, E2E tests (`npm run test:e2e`, Playwright in `tests/e2e`) for user-facing flows, and `tests/rules.test.ts` (`npm run test:rules`) for Firestore rules changes.
- Run the relevant tests before pushing. See the Testing section of README.md for how.
