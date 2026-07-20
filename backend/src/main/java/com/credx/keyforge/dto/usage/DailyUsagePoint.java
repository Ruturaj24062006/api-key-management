package com.credx.keyforge.dto.usage;

public record DailyUsagePoint(
        String date,
        long totalCalls,
        long errorCalls
) {
}
