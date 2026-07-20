package com.credx.keyforge.dto.apikey;

import com.credx.keyforge.entity.ApiKeyStatus;
import com.credx.keyforge.entity.Scope;

import java.time.Instant;
import java.util.List;

public record ApiKeyResponse(
        String id,
        String projectId,
        String projectName,
        String name,
        String keyPrefix,
        List<Scope> scopes,
        ApiKeyStatus status,
        Instant createdAt,
        Instant expiresAt,
        Instant lastUsedAt,
        Integer rateLimitPerMinute
) {
}
