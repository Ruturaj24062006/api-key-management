package com.credx.keyforge.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Platform super-admin endpoints (Role.ADMIN, not org-membership admin).
 * Locked down at the SecurityConfig level via hasRole("ADMIN").
 *
 * TODO: cross-org usage summary for platform admins - total calls, active
 * keys, and error rates across every organization on the platform, probably
 * with a date-range filter. No service/repository support exists yet for
 * aggregating across organizations; UsageAnalyticsService today always scopes
 * by a single organizationId.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @GetMapping("/platform-usage-summary")
    public ResponseEntity<Void> platformUsageSummary() {
        throw new UnsupportedOperationException(
                "Platform-wide usage summary is not implemented yet");
    }
}
