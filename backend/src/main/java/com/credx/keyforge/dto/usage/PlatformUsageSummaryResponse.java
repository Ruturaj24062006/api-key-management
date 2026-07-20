package com.credx.keyforge.dto.usage;

public record PlatformUsageSummaryResponse(
        long totalCalls,
        long activeKeys,
        double errorRate,
        long totalOrganizations,
        long totalProjects
) {}
