# Workflow Email Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the workflow-only identity bypass with existing-account email/password login, cookie session restoration, and logout.

**Architecture:** Add a narrow `AuthService` and HTTP handler inside `backend/api/workflow`, backed by the initialized user domain service. The React app calls three same-origin `/api/auth/*` endpoints and stores only non-secret display state; the HttpOnly cookie remains authoritative.

**Tech Stack:** Go 1.24, Hertz, existing Argon2id user domain, React 18, TypeScript, Vitest, Rsbuild, Bash smoke tests.

## Global Constraints

- Expose only login, session restoration, and logout for existing accounts.
- Keep registration and password reset unavailable.
- Reuse existing password verification, session signing, repositories, and ID generation.
- Never return or log passwords, hashes, or session keys.
- Use a host-only `session_key` cookie with `Path=/`, `HttpOnly`, and `SameSite=Lax`.
- `WORKFLOW_COOKIE_SECURE=1` enables Secure; local HTTP defaults to false.
- Normal development and smoke tests run with `WORKFLOW_AUTH_BYPASS_USER_ID` unset.
- localStorage contains only `userName`, `userId`, and `spaceId`.
- Follow the retrieved `autofill-sign-in-form` guidance for email and password fields.

---

### Task 1: Workflow-only authentication API

**Files:**
- Create: `backend/api/workflow/auth.go`
- Create: `backend/api/workflow/auth_test.go`
- Modify: `backend/api/workflow/router.go`
- Modify: `backend/cmd/workflow-server/main.go`
- Modify: `backend/api/middleware/session.go`

**Interfaces:**
- Consumes: `deps.User.DomainSVC` from `workflowapp.Init`.
- Produces: `NewAuthHandler(AuthService)`, `POST /api/auth/login`, `GET /api/auth/session`, and `POST /api/auth/logout`.

- [ ] **Step 1: Write failing handler tests**

Create `auth_test.go` with a fake for this interface:

```go
type AuthService interface {
    Login(context.Context, string, string) (*userentity.User, error)
    Logout(context.Context, int64) error
    GetUserInfo(context.Context, int64) (*userentity.User, error)
    GetUserSpaceList(context.Context, int64) ([]*userentity.Space, error)
}
```

Use Hertz `route.NewEngine(config.NewOptions(nil))` and `ut.PerformRequest`.
Assert valid login returns the smallest space ID and an HttpOnly SameSite=Lax
cookie; invalid credentials return the same 401; empty input returns 400; no
space returns 403 and calls Logout; session returns current identity; logout
expires the cookie and calls Logout.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd backend
go test ./api/workflow -run 'TestAuth' -count=1
```

Expected: FAIL because `NewAuthHandler` does not exist.

- [ ] **Step 3: Implement the handler**

Add request and response DTOs:

```go
type loginRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

type authUser struct {
    UserID    string `json:"user_id"`
    Name      string `json:"name"`
    Email     string `json:"email"`
    SpaceID   string `json:"space_id"`
    SpaceName string `json:"space_name"`
}
```

Implement login, session, and logout. Sort spaces by ID. Map only
`ErrUserInfoInvalidateCode` to generic 401; unexpected errors become generic
500. Use `ctxutil.GetUIDFromCtx` for protected handlers. Never log the session
value.

- [ ] **Step 4: Register routes and dependencies**

Change the router signature to:

```go
func Register(r *server.Hertz, st storage.Storage, authService AuthService)
```

Register `/api/auth/login`, `/api/auth/session`, and `/api/auth/logout`. Pass
`deps.User.DomainSVC` from `cmd/workflow-server/main.go`. Replace the unused
Passport login allowlist entry in `SessionAuthMW` with `/api/auth/login`.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
cd backend
gofmt -w api/workflow/auth.go api/workflow/auth_test.go api/workflow/router.go cmd/workflow-server/main.go api/middleware/session.go
go test ./api/workflow ./api/middleware ./application/user ./domain/user/service -count=1
go build ./cmd/workflow-server
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend/api/workflow/auth.go backend/api/workflow/auth_test.go backend/api/workflow/router.go backend/cmd/workflow-server/main.go backend/api/middleware/session.go
git commit -m "feat(auth): add workflow email session API"
```

---

### Task 2: Frontend auth client and display-session storage

**Files:**
- Modify: `frontend/apps/workflow-studio/src/api.ts`
- Modify: `frontend/apps/workflow-studio/src/session.ts`
- Modify: `frontend/apps/workflow-studio/src/types.ts`
- Create: `frontend/apps/workflow-studio/__tests__/api.test.ts`
- Create: `frontend/apps/workflow-studio/__tests__/session.test.ts`

**Interfaces:**
- Consumes: `{user_id,name,email,space_id,space_name}` from Task 1.
- Produces: `login`, `restoreSession`, `logout`, `saveSession`, and `clearSession`.

- [ ] **Step 1: Write failing tests**

Mock `globalThis.fetch`. Assert `login('1342018842@qq.com', 'secret')` sends
`POST /api/auth/login`, JSON credentials, and `credentials: 'include'`.
Assert restore uses `GET /api/auth/session`, logout uses
`POST /api/auth/logout`, and failures throw the safe server message. Assert
`saveSession` persists only `userId`, `userName`, and `spaceId`.

- [ ] **Step 2: Verify RED**

```bash
cd frontend/apps/workflow-studio
npm test -- __tests__/api.test.ts __tests__/session.test.ts
```

Expected: FAIL because the auth functions do not exist.

- [ ] **Step 3: Implement auth primitives**

Add `AuthUser` and map it with:

```ts
function toWorkflowSession(user: AuthUser): WorkflowSession {
  return { userId: user.user_id, userName: user.name, spaceId: user.space_id };
}
```

Use `credentials: 'include'` for every auth request. Replace
`createDefaultSession` with `saveSession` and remove synthetic defaults.

- [ ] **Step 4: Verify GREEN and commit**

```bash
cd frontend/apps/workflow-studio
npm test -- __tests__/api.test.ts __tests__/session.test.ts
npm run lint
cd ../../..
git add frontend/apps/workflow-studio
git commit -m "feat(auth): add workflow auth client"
```

---

### Task 3: Email/password UI and app lifecycle

**Files:**
- Modify: `frontend/apps/workflow-studio/src/pages/login.tsx`
- Modify: `frontend/apps/workflow-studio/src/app.tsx`
- Modify: `frontend/apps/workflow-studio/src/session-context.tsx`
- Modify: `frontend/apps/workflow-studio/src/styles.css`
- Create: `frontend/apps/workflow-studio/__tests__/login.test.tsx`

**Interfaces:**
- Consumes: Task 2 auth and session functions.
- Produces: accessible login form, startup restoration, asynchronous logout.

- [ ] **Step 1: Write the failing component test**

Render `LoginPage` with React 18 `createRoot` and `act`. Require:

```text
input[type=email][name=email][autocomplete=username][required]
input[type=password][name=password][autocomplete=current-password][required]
button[type=submit]
```

Assert submission passes email/password, Show password only changes input
type, and failed login preserves email, clears password, and displays the safe
error.

- [ ] **Step 2: Verify RED**

```bash
cd frontend/apps/workflow-studio
npm test -- __tests__/login.test.tsx
```

Expected: FAIL because the current form uses Display Name and Space ID.

- [ ] **Step 3: Implement the UI**

Replace the fields with semantic email/password inputs, stable IDs and names,
required autocomplete values, and a Show password control. Await the credential
callback and clear password after failures.

- [ ] **Step 4: Implement app session lifecycle**

Start `App` in a checking state and call `restoreSession()` once. Save valid
display state, clear stale state on 401, and show the loading screen until the
check finishes. Login via `login(email,password)`. Logout via the server in a
`try/finally` path and always clear local state.

- [ ] **Step 5: Verify and commit**

```bash
cd frontend/apps/workflow-studio
npm test
npm run lint
npm run build
cd ../../..
git add frontend/apps/workflow-studio
git commit -m "feat(auth): restore workflow email login UI"
```

---

### Task 4: Bypass-free environment and authenticated smoke

**Files:**
- Modify: `backend/.env.workflow.example`
- Modify locally: `backend/.env.workflow` (Git ignored)
- Modify: `scripts/workflow_smoke_test.sh`
- Modify: `docs/mirap-workflow-dev-environment.md`

**Interfaces:**
- Consumes: Task 1 login and cookie.
- Produces: normal local auth and cookie-backed end-to-end smoke.

- [ ] **Step 1: Convert smoke to real login**

Seed a known Argon2id hash for `workflow-smoke-password`, create a cookie jar
under `TMP_DIR`, call `/api/auth/login`, require code zero, and attach the jar
to every later curl call. Remove dependence on bypass user `10001` while
keeping the smoke user and space isolated.

- [ ] **Step 2: Disable default bypass and document login**

Set `WORKFLOW_AUTH_BYPASS_USER_ID=` in the tracked example and active ignored
environment. Document email/password login, session cookies, logout, and that
registration/reset remain unavailable.

- [ ] **Step 3: Restart backend and run smoke**

```bash
make workflow-smoke
```

Expected: authenticated login plus existing save/reopen/publish/execute/file
checks pass without bypass.

- [ ] **Step 4: Verify route boundaries**

Require unauthenticated workflow list to return 401 and registration/password
reset routes to return 404. With the operator-supplied old password, verify
`1342018842@qq.com`, `/api/auth/session`, and a migrated workflow in space
`7659729846796288000`.

- [ ] **Step 5: Final verification and commit**

```bash
make test
make build
cd frontend/apps/workflow-studio && npm test && npm run lint && npm run build
cd ../../.. && bash -n scripts/workflow_smoke_test.sh && git diff --check
git add backend/.env.workflow.example scripts/workflow_smoke_test.sh docs/mirap-workflow-dev-environment.md
git commit -m "test(auth): verify cookie-backed workflow login"
```
