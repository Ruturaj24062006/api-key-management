package com.credx.keyforge.dto.auditlog;

import java.time.Instant;

public record AuditLogResponse(
        String id,
        String organizationId,
        String actorUserId,
        String actorEmail,
        String action,
        String targetType,
        String targetId,
        Instant createdAt
) {}
