package com.credx.keyforge.dto.usage;

import java.time.Instant;

public record ErrorLogItem(
        String id,
        String keyName,
        String keyPrefix,
        String endpoint,
        String httpMethod,
        int statusCode,
        String errorReason,
        Instant occurredAt
) {
}
