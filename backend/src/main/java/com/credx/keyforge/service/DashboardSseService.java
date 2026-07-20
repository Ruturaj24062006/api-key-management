package com.credx.keyforge.service;

import com.credx.keyforge.dto.usage.DashboardStatsResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
@RequiredArgsConstructor
@Slf4j
public class DashboardSseService {

    private final Map<String, List<SseEmitter>> emittersByOrg = new ConcurrentHashMap<>();
    private final UsageAnalyticsService usageAnalyticsService;

    public SseEmitter subscribe(String organizationId, String userId) {
        // Set timeout to 30 minutes (1800000 ms)
        SseEmitter emitter = new SseEmitter(1_800_000L);
        List<SseEmitter> emitters = emittersByOrg.computeIfAbsent(organizationId, k -> new CopyOnWriteArrayList<>());
        emitters.add(emitter);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> {
            emitter.complete();
            emitters.remove(emitter);
        });
        emitter.onError(e -> emitters.remove(emitter));

        // Immediately send initial dashboard stats upon connecting
        try {
            DashboardStatsResponse initialStats = usageAnalyticsService.getDashboardStats(userId, organizationId);
            emitter.send(SseEmitter.event().name("dashboard-stats").data(initialStats));
        } catch (Exception e) {
            log.warn("Failed to send initial SSE stats to client: {}", e.getMessage());
            emitters.remove(emitter);
        }

        return emitter;
    }

    public void notifyUsageEvent(String organizationId, String userId) {
        List<SseEmitter> emitters = emittersByOrg.get(organizationId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        try {
            DashboardStatsResponse stats = usageAnalyticsService.getDashboardStats(userId, organizationId);
            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(SseEmitter.event().name("dashboard-stats").data(stats));
                } catch (IOException e) {
                    emitters.remove(emitter);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to broadcast SSE dashboard stats for org {}: {}", organizationId, e.getMessage());
        }
    }
}
