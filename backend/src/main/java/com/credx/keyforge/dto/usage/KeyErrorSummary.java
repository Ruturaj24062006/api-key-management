package com.credx.keyforge.dto.usage;

import java.time.Instant;

public record KeyErrorSummary(
        String keyId,
        String keyName,
        String keyPrefix,
        int rateLimitPerMinute,
        int currentWindowCount,
        long totalBlockedCalls,
        boolean isRateLimited,
        Instant lastUsedAt
) {
}
