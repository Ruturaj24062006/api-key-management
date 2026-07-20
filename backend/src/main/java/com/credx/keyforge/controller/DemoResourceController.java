package com.credx.keyforge.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Simulated "protected resource" that a real KeyForge customer's API would
 * expose. Requests here must carry a valid X-API-Key header - enforced by
 * ApiKeyAuthFilter, not by Spring Security's normal JWT chain. Exists purely
 * to give candidates something to curl / Postman against to see usage logs
 * and rate-limit counters populate in the dashboard.
 */
@RestController
@RequestMapping("/api/demo")
public class DemoResourceController {

    @GetMapping("/protected-resource")
    public ResponseEntity<Map<String, Object>> getProtectedResource() {
        return ResponseEntity.ok(Map.of(
                "message", "You successfully authenticated with a KeyForge API key.",
                "timestamp", Instant.now().toString(),
                "data", Map.of("widgets", 42, "status", "operational")
        ));
    }
}
