package com.credx.keyforge.service;

import com.credx.keyforge.dto.usage.DailyUsagePoint;
import com.credx.keyforge.dto.usage.DashboardStatsResponse;
import com.credx.keyforge.dto.usage.UsageAnalyticsResponse;
import com.credx.keyforge.entity.ApiKey;
import com.credx.keyforge.entity.ApiKeyStatus;
import com.credx.keyforge.entity.ApiKeyUsageLog;
import com.credx.keyforge.entity.Project;
import com.credx.keyforge.exception.ResourceNotFoundException;
import com.credx.keyforge.repository.ApiKeyRepository;
import com.credx.keyforge.repository.ApiKeyUsageLogRepository;
import com.credx.keyforge.repository.ProjectRepository;
import com.credx.keyforge.dto.usage.PlatformUsageSummaryResponse;
import com.credx.keyforge.repository.OrganizationRepository;
import com.credx.keyforge.util.DateFormatUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class UsageAnalyticsService {

    private static final int DEFAULT_WINDOW_DAYS = 30;

    private final ApiKeyUsageLogRepository usageLogRepository;
    private final ApiKeyRepository apiKeyRepository;
    private final ProjectRepository projectRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationAccessService accessService;

    public PlatformUsageSummaryResponse getPlatformUsageSummary() {
        long totalCalls = usageLogRepository.count();
        long totalErrors = usageLogRepository.countByStatusCodeGreaterThanEqual(400);
        long activeKeys = apiKeyRepository.countByStatus(ApiKeyStatus.ACTIVE);
        long totalOrgs = organizationRepository.count();
        long totalProjects = projectRepository.count();

        double errorRate = totalCalls == 0 ? 0.0 : (totalErrors * 100.0) / totalCalls;

        return new PlatformUsageSummaryResponse(totalCalls, activeKeys, round2(errorRate), totalOrgs, totalProjects);
    }

    /**
     * Calls-per-day breakdown for a single key over the last `windowDays`
     * days. Pulls every usage log row in the window and aggregates it in
     * memory, since the response shape (per-day totals + per-day errors)
     * needs a couple of derived fields that were easier to compute in Java
     * while this endpoint was being built out. Works fine against the seed
     * data; something to revisit if a key legitimately sees high volume.
     */
    public UsageAnalyticsResponse getKeyAnalytics(String userId, String organizationId, String apiKeyId, int windowDays) {
        accessService.requireMembership(userId, organizationId);

        ApiKey apiKey = apiKeyRepository.findById(apiKeyId)
                .orElseThrow(() -> new ResourceNotFoundException("API key not found"));
        if (!apiKey.getProject().getOrganization().getId().equals(organizationId)) {
            throw new ResourceNotFoundException("API key not found");
        }

        int days = windowDays > 0 ? windowDays : DEFAULT_WINDOW_DAYS;
        Instant since = Instant.now().minus(days, ChronoUnit.DAYS);

        List<ApiKeyUsageLog> logs = usageLogRepository.findAllByApiKeyIdAndOccurredAtAfter(apiKeyId, since);

        Map<String, long[]> byDay = new LinkedHashMap<>(); // [totalCalls, errorCalls]
        for (ApiKeyUsageLog log : logs) {
            String day = DateFormatUtil.toDayString(log.getOccurredAt());
            long[] counts = byDay.computeIfAbsent(day, d -> new long[2]);
            counts[0]++;
            if (log.getStatusCode() != null && log.getStatusCode() >= 400) {
                counts[1]++;
            }
        }

        List<DailyUsagePoint> breakdown = byDay.entrySet().stream()
                .map(e -> new DailyUsagePoint(e.getKey(), e.getValue()[0], e.getValue()[1]))
                .sorted((a, b) -> a.date().compareTo(b.date()))
                .toList();

        long totalCalls = logs.size();
        long totalErrors = logs.stream().filter(l -> l.getStatusCode() != null && l.getStatusCode() >= 400).count();

        return new UsageAnalyticsResponse(apiKeyId, days, totalCalls, totalErrors, breakdown);
    }

    public DashboardStatsResponse getDashboardStats(String userId, String organizationId) {
        accessService.requireMembership(userId, organizationId);

        List<Project> projects = projectRepository.findAllByOrganizationId(organizationId);

        Instant startOfToday = Instant.now().truncatedTo(ChronoUnit.DAYS);

        long totalCallsToday = 0;
        long totalErrorsToday = 0;
        long activeKeyCount = 0;

        for (Project project : projects) {
            totalCallsToday += usageLogRepository.countByProjectIdSince(project.getId(), startOfToday);
            List<ApiKey> keys = apiKeyRepository.findAllByProjectId(project.getId());
            activeKeyCount += keys.stream().filter(k -> k.getStatus() == ApiKeyStatus.ACTIVE).count();
            for (ApiKey key : keys) {
                totalErrorsToday += usageLogRepository
                        .countByApiKeyIdAndOccurredAtAfterAndStatusCodeGreaterThanEqual(key.getId(), startOfToday, 400);
            }
        }

        double errorRate = totalCallsToday == 0 ? 0.0 : (totalErrorsToday * 100.0) / totalCallsToday;

        return new DashboardStatsResponse(totalCallsToday, activeKeyCount, round2(errorRate), projects.size());
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    /**
     * Legacy formatter kept from before DateFormatUtil existed. Still used by
     * the CSV export path in ReportController-equivalent scripts (ops
     * tooling, not part of this repo) which expect local-time day boundaries
     * instead of UTC. Slightly different output than DateFormatUtil for
     * timestamps close to midnight.
     */
    @Deprecated
    public static String formatDayLocal(Instant instant) {
        return DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneOffset.systemDefault()).format(instant);
    }
}
