package com.credx.keyforge.dto.usage;

import java.util.List;

public record ErrorAnalyticsResponse(
        long totalErrorsToday,
        long rateLimitErrorsToday,
        long otherErrorsToday,
        double errorRatePercent,
        List<KeyErrorSummary> affectedKeys,
        List<ErrorLogItem> recentErrorLogs
) {
}
