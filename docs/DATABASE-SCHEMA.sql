-- KeyForge Database Schema (PostgreSQL)
-- Mirrors the JPA entities in backend/src/main/java/com/credx/keyforge/entity
-- Hibernate is configured with ddl-auto=update for local dev, but this file
-- is the source of truth for a from-scratch / CI database and for seed-data/seed.sql.

-- =========================================================
-- users
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    full_name       VARCHAR(255),
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
    created_at      TIMESTAMP    NOT NULL DEFAULT now()
);

-- =========================================================
-- organizations
-- =========================================================
CREATE TABLE IF NOT EXISTS organizations (
    id          VARCHAR(36)  NOT NULL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(255) NOT NULL UNIQUE,
    plan_tier   VARCHAR(20)  NOT NULL DEFAULT 'FREE' CHECK (plan_tier IN ('FREE', 'PRO', 'ENTERPRISE')),
    owner_id    VARCHAR(36)  NOT NULL REFERENCES users(id),
    created_at  TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);

-- =========================================================
-- organization_memberships
-- =========================================================
CREATE TABLE IF NOT EXISTS organization_memberships (
    id               VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id          VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id  VARCHAR(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role             VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER')),
    joined_at        TIMESTAMP   NOT NULL DEFAULT now(),
    CONSTRAINT uq_membership_user_org UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_org ON organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON organization_memberships(user_id);

-- =========================================================
-- projects
-- =========================================================
CREATE TABLE IF NOT EXISTS projects (
    id               VARCHAR(36)  NOT NULL PRIMARY KEY,
    organization_id  VARCHAR(36)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             VARCHAR(255) NOT NULL,
    description      VARCHAR(1000),
    environment      VARCHAR(20)  NOT NULL DEFAULT 'DEVELOPMENT'
                        CHECK (environment IN ('DEVELOPMENT', 'STAGING', 'PRODUCTION')),
    created_at       TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);

-- =========================================================
-- api_keys
-- =========================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id                     VARCHAR(36)  NOT NULL PRIMARY KEY,
    project_id             VARCHAR(36)  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name                   VARCHAR(255) NOT NULL,
    key_prefix             VARCHAR(20)  NOT NULL,
    hashed_key             VARCHAR(255) NOT NULL UNIQUE,
    status                 VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                              CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
    created_at             TIMESTAMP    NOT NULL DEFAULT now(),
    expires_at             TIMESTAMP,
    last_used_at           TIMESTAMP,
    revoked_at             TIMESTAMP,
    rate_limit_per_minute  INTEGER      NOT NULL DEFAULT 60,
    current_window_count   INTEGER      NOT NULL DEFAULT 0,
    current_window_start   TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys(project_id);

-- =========================================================
-- api_key_scopes (ElementCollection of the Scope enum on ApiKey)
-- =========================================================
CREATE TABLE IF NOT EXISTS api_key_scopes (
    api_key_id  VARCHAR(36) NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    scope       VARCHAR(30) NOT NULL CHECK (scope IN (
                    'READ_USERS', 'WRITE_USERS', 'READ_BILLING', 'WRITE_BILLING',
                    'READ_PROJECTS', 'WRITE_PROJECTS', 'READ_ANALYTICS', 'ADMIN_ALL'
                ))
);

CREATE INDEX IF NOT EXISTS idx_api_key_scopes_key ON api_key_scopes(api_key_id);

-- =========================================================
-- api_key_usage_logs
-- =========================================================
CREATE TABLE IF NOT EXISTS api_key_usage_logs (
    id                VARCHAR(36)  NOT NULL PRIMARY KEY,
    api_key_id        VARCHAR(36)  NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint          VARCHAR(255) NOT NULL,
    http_method       VARCHAR(10)  NOT NULL,
    status_code       INTEGER      NOT NULL,
    response_time_ms  BIGINT       NOT NULL,
    occurred_at       TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_api_key ON api_key_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON api_key_usage_logs(occurred_at);

-- =========================================================
-- audit_logs
-- =========================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id               VARCHAR(36)  NOT NULL PRIMARY KEY,
    organization_id  VARCHAR(36)  NOT NULL,
    actor_user_id    VARCHAR(36)  NOT NULL,
    actor_email      VARCHAR(255) NOT NULL,
    action           VARCHAR(50)  NOT NULL,
    target_type      VARCHAR(50)  NOT NULL,
    target_id        VARCHAR(36)  NOT NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
