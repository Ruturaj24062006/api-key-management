package com.credx.keyforge.controller;

import com.credx.keyforge.dto.usage.DashboardStatsResponse;
import com.credx.keyforge.dto.usage.UsageAnalyticsResponse;
import com.credx.keyforge.security.CurrentUserProvider;
import com.credx.keyforge.service.DashboardSseService;
import com.credx.keyforge.service.UsageAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequiredArgsConstructor
public class UsageController {

    private final UsageAnalyticsService usageAnalyticsService;
    private final DashboardSseService dashboardSseService;
    private final CurrentUserProvider currentUserProvider;

    @GetMapping("/api/organizations/{organizationId}/keys/{apiKeyId}/analytics")
    public ResponseEntity<UsageAnalyticsResponse> keyAnalytics(
            @PathVariable String organizationId,
            @PathVariable String apiKeyId,
            @RequestParam(defaultValue = "30") int windowDays) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.ok(usageAnalyticsService.getKeyAnalytics(userId, organizationId, apiKeyId, windowDays));
    }

    @GetMapping("/api/organizations/{organizationId}/dashboard-stats")
    public ResponseEntity<DashboardStatsResponse> dashboardStats(@PathVariable String organizationId) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.ok(usageAnalyticsService.getDashboardStats(userId, organizationId));
    }

    @GetMapping(value = "/api/organizations/{organizationId}/dashboard/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamDashboardStats(@PathVariable String organizationId) {
        String userId = currentUserProvider.getUserId();
        return dashboardSseService.subscribe(organizationId, userId);
    }
}
