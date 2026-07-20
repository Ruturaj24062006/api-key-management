# KeyForge API Documentation

Base URL (local): `http://localhost:8080`

All endpoints except `/api/auth/**`, `/actuator/health`, `/actuator/info`, and
`/api/demo/protected-resource` require a `Authorization: Bearer <jwt>` header obtained from
`/api/auth/login` or `/api/auth/register`.

`/api/demo/protected-resource` instead requires an `X-API-Key: <full key>` header — it is
authenticated by `ApiKeyAuthFilter`, not the JWT chain, and simulates a customer's own API being
called with a KeyForge-issued key.

`/api/admin/**` additionally requires the caller's JWT to carry `role: ADMIN` (platform
super-admin, not org-membership admin).

All error responses share this shape (`GlobalExceptionHandler`):

```json
{
  "timestamp": "2026-07-19T10:15:00Z",
  "status": 404,
  "error": "NOT_FOUND",
  "message": "Project not found",
  "path": "/api/organizations/org-1/projects/proj-1",
  "details": []
}
```

---

## Auth

### POST /api/auth/register
Create a new user account and receive a JWT immediately (no separate login step needed).

**Auth required:** No

**Request body**
```json
{
  "email": "alice@acme.dev",
  "password": "Password123!",
  "fullName": "Alice Ferreira"
}
```

**Response `201 Created`**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "userId": "b3f1...",
  "email": "alice@acme.dev",
  "fullName": "Alice Ferreira",
  "role": "MEMBER"
}
```

**Errors:** `400` validation failure, `409` email already registered.

---

### POST /api/auth/login
**Auth required:** No

**Request body**
```json
{ "email": "alice@acme.dev", "password": "Password123!" }
```

**Response `200 OK`** — same shape as register.

**Errors:** `401` invalid credentials.

---

## Organizations

### POST /api/organizations
Create an organization; caller becomes its `OWNER`.

**Auth required:** Yes

**Request body**
```json
{ "name": "Acme Corp" }
```

**Response `201 Created`**
```json
{
  "id": "org-1",
  "name": "Acme Corp",
  "slug": "acme-corp",
  "planTier": "FREE",
  "ownerId": "user-1",
  "currentUserRole": "OWNER",
  "createdAt": "2026-07-19T10:00:00Z"
}
```

---

### GET /api/organizations
List organizations the caller is a member of.

**Auth required:** Yes

**Response `200 OK`** — array of the same shape as above.

---

### GET /api/organizations/{organizationId}
**Auth required:** Yes (must be a member)

**Response `200 OK`** — single organization object. **Errors:** `403` not a member.

---

### POST /api/organizations/{organizationId}/members
Invite an existing KeyForge user into the org.

**Auth required:** Yes, caller must be `OWNER` or `ADMIN` in this org.

**Request body**
```json
{ "email": "bob@acme.dev", "role": "MEMBER" }
```

**Response `201 Created`**
```json
{
  "id": "mem-1",
  "userId": "user-2",
  "userEmail": "bob@acme.dev",
  "userFullName": "Bob Nakamura",
  "role": "MEMBER",
  "joinedAt": "2026-07-19T10:05:00Z"
}
```

**Errors:** `403` insufficient role, `404` no account for that email, `409` already a member.

---

### GET /api/organizations/{organizationId}/members
**Auth required:** Yes (must be a member)

**Response `200 OK`** — array of membership objects (shape above).

---

## Projects

Base path: `/api/organizations/{organizationId}/projects`

### POST /api/organizations/{organizationId}/projects
**Auth required:** Yes, any org member (`OWNER`/`ADMIN`/`MEMBER`)

**Request body**
```json
{
  "name": "Acme Public API",
  "description": "Customer-facing REST API",
  "environment": "PRODUCTION"
}
```

**Response `201 Created`**
```json
{
  "id": "proj-1",
  "organizationId": "org-1",
  "name": "Acme Public API",
  "description": "Customer-facing REST API",
  "environment": "PRODUCTION",
  "activeKeyCount": 0,
  "createdAt": "2026-07-19T10:10:00Z"
}
```

### GET /api/organizations/{organizationId}/projects
**Auth required:** Yes (member). **Response:** array of project objects.

### GET /api/organizations/{organizationId}/projects/{projectId}
**Auth required:** Yes (member). **Errors:** `404` if project doesn't belong to this org.

### PUT /api/organizations/{organizationId}/projects/{projectId}
**Auth required:** `OWNER` or `ADMIN`. Same body shape as create.

### DELETE /api/organizations/{organizationId}/projects/{projectId}
**Auth required:** `OWNER` only. **Response:** `204 No Content`.

---

## API Keys

### POST /api/organizations/{organizationId}/projects/{projectId}/keys
Generates a new API key. **The full plaintext key is returned exactly once, in this response.**

**Auth required:** Yes, any org member.

**Request body**
```json
{
  "name": "Production Server Key",
  "scopes": ["READ_USERS", "WRITE_USERS", "READ_BILLING"],
  "expiresAt": "2026-12-31T00:00:00Z",
  "rateLimitPerMinute": 120
}
```
`expiresAt` is optional (omit/null for a key that never expires).

**Response `201 Created`**
```json
{
  "apiKey": {
    "id": "key-1",
    "projectId": "proj-1",
    "projectName": "Acme Public API",
    "name": "Production Server Key",
    "keyPrefix": "kf_live_ab12cd34",
    "scopes": ["READ_USERS", "WRITE_USERS", "READ_BILLING"],
    "status": "ACTIVE",
    "createdAt": "2026-07-19T10:15:00Z",
    "expiresAt": "2026-12-31T00:00:00Z",
    "lastUsedAt": null,
    "rateLimitPerMinute": 120
  },
  "fullKey": "kf_live_ab12cd34EXAMPLE_FULL_SECRET_DO_NOT_LOG"
}
```

**Errors:** `400` validation (e.g. no scopes selected), `403` not a member, `404` project not
found in this org.

---

### GET /api/organizations/{organizationId}/projects/{projectId}/keys
Paginated list of keys for a project.

**Auth required:** Yes (member).

**Query params:** `page` (0-indexed, default 0), `size` (default 20), `sort`

**Response `200 OK`** — Spring `Page<ApiKeyResponse>`:
```json
{
  "content": [ { "id": "key-1", "name": "Production Server Key", "keyPrefix": "kf_live_ab12cd34", "status": "ACTIVE", "...": "..." } ],
  "totalElements": 4,
  "totalPages": 1,
  "number": 0,
  "size": 20,
  "first": true,
  "last": true
}
```

---

### GET /api/keys/{apiKeyId}
Fetch a single key by id.

**Auth required:** Yes (any authenticated user — see README "Known Bugs" section regarding
cross-org access to this endpoint).

**Response `200 OK`** — single `ApiKeyResponse` (shape above, without `fullKey`).

**Errors:** `404` key not found.

---

### POST /api/keys/{apiKeyId}/revoke
Soft-deletes a key (sets `status = REVOKED`, `revokedAt = now()`). Irreversible from the API.

**Auth required:** Yes (see README note above — same scoping caveat as GET).

**Response:** `204 No Content`. **Errors:** `404` key not found.

---

### POST /api/keys/{apiKeyId}/rotate
**Not implemented.** Always returns `501 Not Implemented`.

**Response `501`**
```json
{
  "timestamp": "2026-07-19T10:20:00Z",
  "status": 501,
  "error": "NOT_IMPLEMENTED",
  "message": "Key rotation is not implemented yet",
  "path": "/api/keys/key-1/rotate",
  "details": []
}
```

---

## Usage & Analytics

### GET /api/organizations/{organizationId}/keys/{apiKeyId}/analytics
Calls-per-day breakdown for a single key.

**Auth required:** Yes (member).

**Query params:** `windowDays` (default 30)

**Response `200 OK`**
```json
{
  "apiKeyId": "key-1",
  "windowDays": 30,
  "totalCalls": 412,
  "totalErrors": 9,
  "dailyBreakdown": [
    { "date": "2026-06-20", "totalCalls": 14, "errorCalls": 0 },
    { "date": "2026-06-21", "totalCalls": 22, "errorCalls": 1 }
  ]
}
```

---

### GET /api/organizations/{organizationId}/keys/{apiKeyId}/usage-logs
Paginated raw usage log entries for a key.

**Auth required:** Yes (member).

**Query params:** `page`, `size` (default 25), `sort`

**Response `200 OK`** — `Page<UsageLogResponse>`:
```json
{
  "content": [
    {
      "id": "log-1",
      "apiKeyId": "key-1",
      "apiKeyPrefix": "kf_live_ab12cd34",
      "endpoint": "/api/demo/protected-resource",
      "httpMethod": "GET",
      "statusCode": 200,
      "responseTimeMs": 84,
      "occurredAt": "2026-07-19T09:58:12Z"
    }
  ],
  "totalElements": 412,
  "totalPages": 17,
  "number": 0,
  "size": 25,
  "first": true,
  "last": false
}
```

---

### GET /api/organizations/{organizationId}/dashboard-stats
Aggregate stats for the dashboard cards.

**Auth required:** Yes (member).

**Response `200 OK`**
```json
{
  "totalApiCallsToday": 128,
  "activeKeyCount": 3,
  "errorRatePercent": 2.34,
  "totalProjects": 2
}
```

---

## Demo protected resource

### GET /api/demo/protected-resource
Simulated customer-facing endpoint. Requires a valid, active, non-expired API key. Every call is
recorded as a usage log entry and counted against the key's rate limit window (the limit is
tracked but **not yet enforced** — see README "Missing Features").

**Auth required:** `X-API-Key: kf_live_...` header (not a JWT)

**Response `200 OK`**
```json
{
  "message": "You successfully authenticated with a KeyForge API key.",
  "timestamp": "2026-07-19T10:25:00Z",
  "data": { "widgets": 42, "status": "operational" }
}
```

**Errors:** `401` missing/invalid/expired/revoked key.

---

## Admin (platform super-admin only)

### GET /api/admin/platform-usage-summary
**Not implemented.** Always returns `501 Not Implemented`. Requires `role: ADMIN` on the JWT to
even reach the handler (`403` otherwise) — see README "Missing Features".

---

## Internal reporting

### GET /api/reports/projects/{projectId}/keys/export
Unpaginated dump of all keys for a project, used by an ops CSV export script. Not linked from the
dashboard nav. **Auth required:** Yes (any authenticated user — no org/project scoping check is
performed here beyond the JWT filter).

**Response `200 OK`** — array of `ApiKeyResponse`.
