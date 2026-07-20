package com.credx.keyforge.dto.usage;

public record DashboardStatsResponse(
        long totalApiCallsToday,
        long activeKeyCount,
        double errorRatePercent,
        long totalProjects
) {
}
