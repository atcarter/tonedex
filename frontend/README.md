# ToneDex frontend

React 19 + TypeScript SPA built with Vite. Talks to the Rails API at
`VITE_API_URL` (see the root `.env.example`). Part of the monorepo — the root
[README](../README.md) covers Docker Compose and env setup, and
[ARCHITECTURE](../ARCHITECTURE.md) covers the system as a whole.

## Stack

- **UI:** MUI v7 + styled-components (both consume one theme — see
  `src/ThemedApp.tsx` and `src/styled.d.ts`); light/dark mode
- **Server state:** TanStack React Query v5 — focused hooks in `src/hooks/`
  (see ADR-007); client state lives in `AppContext` (auth + selected game)
  and `UiContext` (toast, color mode)
- **Routing:** React Router v7; the URL is the source of truth for the
  selected game
- **Auth:** `@react-oauth/google` → JWT from the API, kept in `localStorage`
- **Errors:** Sentry (production only), plus a route-level `ErrorBoundary`

## Scripts

```bash
npm run dev            # Vite dev server on :5173
npm run build          # tsc -b && vite build (CI check)
npm run lint           # ESLint (CI check)
npm run format         # Prettier write
npm run format:check   # Prettier check (CI check)
npm test               # Vitest unit tests
npm run test:e2e       # Playwright (needs the app running on :5173)
```

Day-to-day commands run inside Docker
(`docker compose exec frontend …`), but the toolchain also works directly on
the host after `npm install`.

## Testing

- **Unit:** Vitest + Testing Library (`src/**/*.test.{ts,tsx}`)
- **E2E:** Playwright specs in `e2e/`; all API calls are intercepted with
  route mocks (`e2e/fixtures.ts`), so no backend is needed by the test runner
