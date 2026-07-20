package com.credx.keyforge.service;

import com.credx.keyforge.entity.ApiKey;
import com.credx.keyforge.entity.ApiKeyUsageLog;
import com.credx.keyforge.repository.ApiKeyUsageLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class UsageLoggingService {

    private final ApiKeyUsageLogRepository usageLogRepository;

    @Transactional
    public void recordUsage(ApiKey apiKey, String endpoint, String httpMethod, int statusCode, long responseTimeMs) {
        ApiKeyUsageLog log = ApiKeyUsageLog.builder()
                .apiKey(apiKey)
                .endpoint(endpoint)
                .httpMethod(httpMethod)
                .statusCode(statusCode)
                .responseTimeMs(responseTimeMs)
                .occurredAt(Instant.now())
                .build();
        usageLogRepository.save(log);
    }
}
