# ADR-006: Google OAuth — User Accounts and Sidekiq Protection

**Date:** 2026-03-02
**Status:** Accepted

---

## Context

Two independent problems needed solving:

1. **Favorites persistence** — favorites lived in `localStorage`, which is browser-local and fragile. Moving them to the database requires user identity.
2. **Sidekiq UI access control** — `/sidekiq` was unprotected. Only the owner should be able to access it.

Both problems involve Google authentication, but they serve different audiences (any user vs. one specific owner) and run in different execution contexts (SPA → API vs. browser → server-rendered page).

---

## Decision

Use a single Google OAuth app with **two independent auth flows**:

| Flow | Who | Mechanism | Credential |
|---|---|---|---|
| SPA → API | Any user | Google ID token → backend JWT | `Authorization: Bearer <jwt>` header |
| Browser → Sidekiq UI | Owner only | OmniAuth server-side redirect | Session cookie |

### Flow A — Any user (SPA auth)

1. Frontend renders a `<GoogleLogin>` button via `@react-oauth/google`.
2. User signs in; Google returns an ID token (a short-lived JWT signed by Google).
3. Frontend `POST /api/v1/auth/google { id_token }`.
4. Backend verifies the ID token using `Google::Auth::IDTokens.verify_oidc` (`googleauth` gem — Google's official library).
5. Backend finds or creates the `User` record (`google_uid` as the stable identifier).
6. Backend issues its own 30-day JWT containing `{ user_id, email, exp }`.
7. Frontend stores the JWT in `localStorage` and sends it as `Authorization: Bearer` on all subsequent API calls.
8. `ApplicationController#authenticate_user!` decodes the JWT and sets `@current_user`.

### Flow B — Owner only (Sidekiq browser auth)

1. Request hits `/sidekiq`.
2. `SidekiqAuth` Rack middleware checks `rack.session[:sidekiq_authed]`.
3. If not set → 302 to `/auth/login` (inline HTML login page).
4. User submits the form → POST to `/auth/google_oauth2` → OmniAuth redirects to Google.
5. Google redirects to `/auth/google_oauth2/callback`.
6. `AuthController#callback` checks `email == ENV["SIDEKIQ_ALLOWED_EMAIL"]`.
7. On match → `session[:sidekiq_authed] = true` → 302 to `/sidekiq`.
8. Session cookie expires after 30 minutes.

The two flows share one Google OAuth client ID/secret but are otherwise independent. Flow A never touches sessions; Flow B never touches JWTs.

### Why `googleauth` instead of `google-id-token`?

`google-id-token` was last updated in 2017 and is effectively abandoned. `googleauth` is Google's officially maintained Ruby auth library (v1.16.2, released 2025) and provides `Google::Auth::IDTokens` as a first-class API.

---

## Consequences

**Positive:**
- Any user can create an account and have their favorites persist across devices and browsers.
- Sidekiq UI is now access-controlled; no credentials exposed in source.
- The two auth mechanisms are fully independent — a bug in one cannot affect the other.
- JWTs are stateless; no session table needed for API clients.

**Negative / Trade-offs:**
- Two auth mechanisms to understand and maintain.
- `JWT_SECRET` rotation invalidates all active user sessions simultaneously (no graceful migration). Document the runbook; consider short-lived tokens + refresh tokens in a future iteration (see BACKLOG.md).
- JWT expiry (30 days) is silent — the app returns 401 with no UX feedback. Planned fix in BACKLOG.md.
- Sidekiq session cookie expires after 30 minutes; owner must re-authenticate frequently during long admin sessions.

---

## Alternatives Considered

- **HTTP Basic Auth for Sidekiq** — the original BACKLOG.md suggestion. Simpler but requires a shared username/password that must be rotated separately. Rejected in favour of tying Sidekiq access to the existing Google account.
- **Single auth mechanism for both** — using JWT for Sidekiq too would require a custom Sidekiq middleware that can parse headers. Sidekiq Web is a Rack app designed for browser use; session cookies are the natural fit.
- **`devise` + `omniauth`** — full-featured but heavy; this app needs only `find_or_create_by` on Google UID, not registration flows, password resets, or email confirmation.
