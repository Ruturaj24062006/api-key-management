package com.credx.keyforge.dto.project;

import com.credx.keyforge.entity.Environment;

import java.time.Instant;

public record ProjectResponse(
        String id,
        String organizationId,
        String name,
        String description,
        Environment environment,
        long activeKeyCount,
        Instant createdAt
) {
}
