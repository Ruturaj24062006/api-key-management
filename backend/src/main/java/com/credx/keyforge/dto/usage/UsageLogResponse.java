package com.credx.keyforge.dto.usage;

import java.time.Instant;

public record UsageLogResponse(
        String id,
        String apiKeyId,
        String apiKeyPrefix,
        String endpoint,
        String httpMethod,
        Integer statusCode,
        Long responseTimeMs,
        Instant occurredAt
) {
}
