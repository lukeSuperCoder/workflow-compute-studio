# Workflow Email Authentication Design

## Goal

Replace the workflow-only local identity bypass with real email/password sign-in
for existing migrated users, persistent cookie-backed sessions, and server-side
logout. Registration and password reset remain unavailable.

## Scope

Included:

- Sign in with an existing user's email and password.
- Verify the migrated Argon2id password hash through the existing user domain
  service.
- Issue and validate the existing `session_key` session cookie.
- Restore a signed-in frontend session after a page reload.
- Sign out by invalidating the database session and deleting the cookie.
- Resolve the signed-in user's accessible spaces and enter the first space.
- Update workflow smoke coverage to use real authentication.

Excluded:

- User registration.
- Password reset or password change.
- Email verification.
- Social login, SSO, passkeys, or multi-factor authentication.
- A multi-space switching interface. The first accessible space is selected.

## Chosen Approach

Add a small workflow-only authentication API that delegates password and
session operations to the existing `application/user` and `domain/user`
services. This keeps the workflow router narrow while reusing the platform's
Argon2id verification, session signing, database repositories, and ID
generation.

The rejected alternatives are restoring the full generated Passport handler
surface, which would pull registration and unrelated platform routes back into
the reduced server, and implementing authentication directly against GORM,
which would duplicate security-sensitive password and session logic.

## Backend API

The workflow-only router adds three endpoints under `/api/auth`.

### `POST /api/auth/login`

This is the only unauthenticated auth endpoint.

Request:

```json
{
  "email": "user@example.com",
  "password": "user supplied password"
}
```

Successful response:

```json
{
  "code": 0,
  "data": {
    "user_id": "7659729846792093696",
    "name": "1342018842",
    "email": "1342018842@qq.com",
    "space_id": "7659729846796288000",
    "space_name": "Personal Space"
  }
}
```

The handler binds and validates non-empty credentials, calls the existing user
application login method, loads spaces through the existing user domain
service, and selects the accessible space with the smallest numeric ID for a
deterministic default. If the user has no accessible space, the newly issued
session is invalidated and the request fails without setting a cookie.

Invalid email and invalid password return the same public message: `Email or
password is incorrect`. Internal errors are logged without logging the email,
password, password hash, or session key.

### `GET /api/auth/session`

This endpoint is protected by `SessionAuthMW`. It reads the authenticated user
from the request context, loads the current user and spaces, and returns the
same response shape as login. An absent, invalid, or expired cookie returns
HTTP 401.

### `POST /api/auth/logout`

This endpoint is protected by `SessionAuthMW`. It clears the current user's
database session key, expires the browser cookie, and returns:

```json
{"code":0}
```

Logout is idempotent from the frontend's perspective: local state is cleared
even if the network request fails or the server session already expired.

## Cookie and Session Security

The cookie name remains `session_key`, matching the existing middleware and
user domain implementation.

- `Path=/`
- `HttpOnly=true`
- `SameSite=Lax`
- Host-only cookie: no explicit `Domain`
- Existing `SessionMaxAgeSecond` lifetime
- `Secure=false` for local HTTP development
- `Secure=true` when `WORKFLOW_COOKIE_SECURE=1`

The session key is never returned in JSON or written to logs. CORS remains
irrelevant to the normal development path because Rsbuild proxies `/api` to the
backend and the browser sees a same-origin request.

## Authentication Bypass

`WORKFLOW_AUTH_BYPASS_USER_ID` remains supported only as an explicit diagnostic
escape hatch in middleware, but workflow environment templates and generated
local configuration leave it empty. Normal development, manual validation, and
smoke tests must not depend on bypass user `10001`.

The middleware unauthenticated allowlist contains `/healthz`, static assets,
and `/api/auth/login` only. The unused Passport login allowlist entry is
removed from the workflow-only runtime.

## Frontend Flow

The login page replaces Display Name and Space ID with:

- Email input using `type="email"`, `name="email"`,
  `autocomplete="username"`, and `required`.
- Password input using `type="password"`, `name="password"`,
  `autocomplete="current-password"`, and `required`.
- A Show password control that does not block password-manager paste or
  autofill.
- A submit button with an in-progress state and a generic authentication error.

The frontend posts credentials with `credentials: "include"`. On success it
stores only non-secret display session data (`userId`, `userName`, `spaceId`)
and navigates to the workflow list.

At application startup, the frontend calls `/api/auth/session` before choosing
between the login route and the application shell. A successful response
refreshes local display state. HTTP 401 clears stale local state and shows the
login page. The password and session key are never stored in localStorage.

The existing Sign out button calls `/api/auth/logout`, clears local display
state in a `finally` path, and navigates to `/login`.

## Component Boundaries

- `backend/api/workflow/auth.go`: workflow-only HTTP binding, cookie handling,
  public response DTOs, and auth error mapping.
- `backend/api/workflow/router.go`: registers the three auth endpoints and
  receives the already-initialized user application service.
- `backend/api/middleware/session.go`: narrows the unauthenticated allowlist;
  existing cookie validation remains unchanged.
- `frontend/apps/workflow-studio/src/api.ts`: typed login, session, and logout
  requests.
- `frontend/apps/workflow-studio/src/session.ts`: stores non-secret display
  data only; no default synthetic identity.
- `frontend/apps/workflow-studio/src/pages/login.tsx`: accessible email and
  password form.
- `frontend/apps/workflow-studio/src/app.tsx`: startup session restoration and
  asynchronous logout.
- `scripts/workflow_smoke_test.sh`: seeds a known test password hash, logs in
  with a cookie jar, and runs all existing workflow checks through that cookie.

## Error Handling

- Empty or malformed login input: HTTP 400.
- Invalid credentials: HTTP 401 with the same generic message for both missing
  accounts and incorrect passwords.
- Authenticated user with no accessible space: HTTP 403 and no retained
  session.
- Invalid or expired session: HTTP 401.
- Database, storage, ID generation, or unexpected service failure: HTTP 500
  with a generic client message and detailed server-side logging that excludes
  secrets.

The frontend displays server-provided safe messages and retains the email field
after a failed attempt, but always clears the password field.

## Testing Strategy

Backend tests cover:

- Successful login sets an HttpOnly SameSite=Lax cookie and returns the user's
  first accessible space.
- Incorrect email and incorrect password are indistinguishable to the client.
- A user without an accessible space does not retain a new session.
- Session restoration rejects a missing or invalid cookie.
- Logout invalidates the database session and expires the cookie.
- `WORKFLOW_AUTH_BYPASS_USER_ID` is not required for these tests.

Frontend Vitest coverage includes:

- Login submits email and password through the auth API.
- Password visibility can be toggled without changing the value.
- Failed login preserves email, clears password, and shows the safe error.
- Startup restores a valid cookie session and discards stale local state on
  HTTP 401.
- Sign out calls the server and clears local state even on request failure.

Integration verification includes:

- Workflow-only Go tests and build.
- Workflow Studio Vitest, lint, and production build.
- A real login using the migrated account and its existing password.
- Save, reopen, publish, execute, and file smoke paths using the authenticated
  cookie.
- Verification that registration and password-reset routes return 404.

## Acceptance Criteria

- The login page contains email and password inputs and no Display Name or
  manually entered Space ID.
- The migrated user `1342018842@qq.com` can sign in with the password from the
  old system and see workflows in space `7659729846796288000`.
- Refreshing the page keeps the user signed in through the HttpOnly cookie.
- Signing out invalidates the server session and returns to the login page.
- Requests without a valid cookie cannot access workflow or private-file APIs.
- Local and smoke workflows run with `WORKFLOW_AUTH_BYPASS_USER_ID` unset.
- Registration and password reset are not exposed by the workflow-only server.
