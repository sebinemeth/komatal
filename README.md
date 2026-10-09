# Komatál

Hungarian web app for organising a komatál: meals for a family with a newborn.
The organiser creates a komatál and shares one link. Helpers join a wait list before the birth;
"Baba megszületett" notifies them and opens day reservations.

Stack: Vue 3, Vite, [Nuxt UI](https://ui.nuxt.com) (Tailwind), Lucide icons, Firebase (Auth, Firestore, Hosting, Cloud Functions, FCM).

## How privacy works

Everything personal is encrypted in the browser (WebCrypto). The server stores ciphertext.

| Data | Readable by |
| --- | --- |
| Family name, expected birth date, status, slot dates and status | Server, everyone |
| Address, allergies, delivery window, notes, organiser contact, meals and notes, helper aliases, feed posts and pictures | Anyone with the link password (key K) |
| Helper phone and email | Organiser only (sealed to the organiser's public key) |
| Helper email / push token for sending notifications | Cloud Functions only (never readable by clients) |

- K is derived (PBKDF2) from the komatál password, which travels in the invite link's `#fragment` and is never sent to a server.
- The organiser's private key and komatál passwords live in an encrypted **vault** (`users/{uid}/vault/main`), unlocked with the login password. A recovery code (shown once at sign-up) unlocks it after a password reset. The unlocked key is remembered per device in IndexedDB.
- "Shown after reservation" is a UI gate: anyone holding the link can decrypt every field.

See `src/lib/crypto.ts`, `src/lib/vault.ts`, `firestore.rules`.

## Develop

```sh
npm install
npm run dev          # uses the real Firebase project `komatal`
npm test             # crypto, vault, schedule unit tests
npm run test:rules   # Firestore rules against the emulator (needs Java)
npm run test:e2e     # browser flow against Auth + Firestore emulators
npm run build
```

For local work against emulators: `npm run emulators` and `VITE_USE_EMULATORS=true npm run dev`.

## Firebase setup (once)

1. Firestore: create the database (Firestore Database → Create database, location `eur3` or another EU region).
2. Authentication → Sign-in method: enable **Email/Password** and **Anonymous**.
3. Deploy rules and the app: `firebase deploy --only firestore,hosting`.
4. Notifications (optional, needs the **Blaze** plan): `firebase deploy --only functions`.
   - Email: install the "Trigger Email from Firestore" extension on the `mail` collection.
   - Push: works with the default FCM key; set the function region in `functions/index.js` to match the database location.

`mockup/` holds the first static UI mockup and is not deployed.

## Testing

**Every new feature or behaviour change must come with tests: unit tests (`src/**/*.test.ts`, `npm test`) for logic, and E2E tests (`tests/e2e`, `npm run test:e2e`) for user-facing flows, wherever they apply.** Changes to `firestore.rules` also need a case in `tests/rules.test.ts` (`npm run test:rules`). CI runs all three on every pull request and on pushes to `develop` and `main`.

### E2E tests

`npm run test:e2e` starts the Auth and Firestore emulators plus the Vite dev server and runs the Playwright flow in `tests/e2e` (needs Java). Locally run `npx playwright install chromium` once; in the Claude cloud env the preinstalled Chromium is used automatically (a SessionStart hook installs dependencies). CI runs the unit, rules and E2E tests on pushes to `develop` and `main` (`.github/workflows/tests.yml`).
