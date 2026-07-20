package com.credx.keyforge.dto.org;

import com.credx.keyforge.entity.PlanTier;

import java.time.Instant;

public record OrganizationResponse(
        String id,
        String name,
        String slug,
        PlanTier planTier,
        String ownerId,
        String currentUserRole,
        Instant createdAt
) {
}
