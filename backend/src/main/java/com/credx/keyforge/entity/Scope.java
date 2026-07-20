package com.credx.keyforge.entity;

/**
 * Permission scopes that can be attached to an ApiKey.
 *
 * Design tradeoff: modeled as an enum (persisted as an ElementCollection of
 * strings on ApiKey) rather than a first-class Scope/Permission entity with
 * its own table. This is simpler and perfectly fine for a fixed, small set
 * of permissions known at compile time. If scopes needed to be dynamic
 * (org-defined custom permissions, per-plan scope catalogs, etc.) this should
 * become a proper entity with a join table instead.
 */
public enum Scope {
    READ_USERS,
    WRITE_USERS,
    READ_BILLING,
    WRITE_BILLING,
    READ_PROJECTS,
    WRITE_PROJECTS,
    READ_ANALYTICS,
    ADMIN_ALL
}
