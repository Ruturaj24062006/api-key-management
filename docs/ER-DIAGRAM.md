# KeyForge — Entity Relationship Diagram

This diagram reflects the JPA entities under `backend/src/main/java/com/credx/keyforge/entity`
and the tables in `docs/DATABASE-SCHEMA.sql`.

```mermaid
erDiagram
    USER ||--o{ ORGANIZATION_MEMBERSHIP : "has"
    USER ||--o{ ORGANIZATION : "owns"
    ORGANIZATION ||--o{ ORGANIZATION_MEMBERSHIP : "has"
    ORGANIZATION ||--o{ PROJECT : "contains"
    PROJECT ||--o{ API_KEY : "issues"
    API_KEY ||--o{ API_KEY_USAGE_LOG : "generates"
    API_KEY ||--o{ API_KEY_SCOPE : "has"

    USER {
        string id PK
        string email UK
        string full_name
        string password_hash
        string role "ADMIN | MEMBER"
        timestamp created_at
    }

    ORGANIZATION {
        string id PK
        string name
        string slug UK
        string plan_tier "FREE | PRO | ENTERPRISE"
        string owner_id FK
        timestamp created_at
    }

    ORGANIZATION_MEMBERSHIP {
        string id PK
        string user_id FK
        string organization_id FK
        string role "OWNER | ADMIN | MEMBER"
        timestamp joined_at
    }

    PROJECT {
        string id PK
        string organization_id FK
        string name
        string description
        string environment "DEVELOPMENT | STAGING | PRODUCTION"
        timestamp created_at
    }

    API_KEY {
        string id PK
        string project_id FK
        string name
        string key_prefix "visible, e.g. kf_live_ab12"
        string hashed_key UK "SHA-256, plaintext never stored"
        string status "ACTIVE | REVOKED | EXPIRED"
        timestamp created_at
        timestamp expires_at "nullable"
        timestamp last_used_at
        timestamp revoked_at
        int rate_limit_per_minute
        int current_window_count
        timestamp current_window_start
    }

    API_KEY_SCOPE {
        string api_key_id FK
        string scope "READ_USERS | WRITE_USERS | READ_BILLING | ..."
    }

    API_KEY_USAGE_LOG {
        string id PK
        string api_key_id FK
        string endpoint
        string http_method
        int status_code
        bigint response_time_ms
        timestamp occurred_at
    }

    AUDIT_LOG {
        string id PK
        string organization_id
        string actor_user_id
        string actor_email
        string action "API_KEY_CREATED | API_KEY_REVOKED"
        string target_type
        string target_id
        timestamp created_at
    }
```

## Notes on design choices

- **Scopes as an enum, not an entity.** `Scope` (`READ_USERS`, `WRITE_USERS`, etc.) is a fixed,
  compile-time enum persisted via `@ElementCollection` into `api_key_scopes` rather than a
  first-class `Scope`/`Permission` table with its own primary key. This is simpler for a small,
  known permission set. If organizations ever needed custom/dynamic scopes, this should become a
  real entity with a join table and per-org catalog.
- **`AUDIT_LOG` is intentionally not tied by foreign key to `ORGANIZATION`/`USER`.** It stores
  denormalized `organization_id`, `actor_user_id`, and `actor_email` so audit history survives
  even if the acting user or org is later deleted. There's currently no read API for this table —
  see the README's Missing Features section.
- **`current_window_count` / `current_window_start` on `API_KEY`** back the per-minute rate-limit
  counter. They live directly on the key row rather than a separate table, which is what makes the
  read-then-write update pattern in `ApiKeyValidationService` worth scrutinizing under concurrent
  load.
