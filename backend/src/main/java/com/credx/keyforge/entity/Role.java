package com.credx.keyforge.entity;

/**
 * Platform-level role, distinct from OrganizationMembership.role.
 * ADMIN here means "platform super-admin" (used for cross-org analytics),
 * not "admin of one organization".
 */
public enum Role {
    ADMIN,
    MEMBER
}
