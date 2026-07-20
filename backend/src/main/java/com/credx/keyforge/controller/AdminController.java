package com.credx.keyforge.controller;

import com.credx.keyforge.dto.usage.PlatformUsageSummaryResponse;
import com.credx.keyforge.service.UsageAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UsageAnalyticsService usageAnalyticsService;

    @GetMapping("/platform-usage-summary")
    public ResponseEntity<PlatformUsageSummaryResponse> platformUsageSummary() {
        return ResponseEntity.ok(usageAnalyticsService.getPlatformUsageSummary());
    }
}
