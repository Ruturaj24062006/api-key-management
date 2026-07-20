package com.credx.keyforge.dto.usage;

import java.util.List;

public record UsageAnalyticsResponse(
        String apiKeyId,
        int windowDays,
        long totalCalls,
        long totalErrors,
        List<DailyUsagePoint> dailyBreakdown
) {
}
