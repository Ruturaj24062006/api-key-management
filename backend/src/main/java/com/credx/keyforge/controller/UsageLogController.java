package com.credx.keyforge.controller;

import com.credx.keyforge.dto.usage.UsageLogResponse;
import com.credx.keyforge.entity.ApiKey;
import com.credx.keyforge.exception.ResourceNotFoundException;
import com.credx.keyforge.repository.ApiKeyRepository;
import com.credx.keyforge.repository.ApiKeyUsageLogRepository;
import com.credx.keyforge.security.CurrentUserProvider;
import com.credx.keyforge.service.OrganizationAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@SuppressWarnings("null")
public class UsageLogController {

    private final ApiKeyUsageLogRepository usageLogRepository;
    private final ApiKeyRepository apiKeyRepository;
    private final OrganizationAccessService accessService;
    private final CurrentUserProvider currentUserProvider;

    @Transactional(readOnly = true)
    @GetMapping("/api/organizations/{organizationId}/keys/{apiKeyId}/usage-logs")
    public ResponseEntity<Page<UsageLogResponse>> listUsageLogs(
            @PathVariable String organizationId,
            @PathVariable String apiKeyId,
            @PageableDefault(size = 25) Pageable pageable) {
        String userId = currentUserProvider.getUserId();
        accessService.requireMembership(userId, organizationId);

        ApiKey apiKey = apiKeyRepository.findById(apiKeyId)
                .orElseThrow(() -> new ResourceNotFoundException("API key not found"));
        if (!apiKey.getProject().getOrganization().getId().equals(organizationId)) {
            throw new ResourceNotFoundException("API key not found");
        }

        Page<UsageLogResponse> page = usageLogRepository
                .findAllByApiKeyIdOrderByOccurredAtDesc(apiKeyId, pageable)
                .map(log -> new UsageLogResponse(
                        log.getId(),
                        apiKeyId,
                        apiKey.getKeyPrefix(),
                        log.getEndpoint(),
                        log.getHttpMethod(),
                        log.getStatusCode(),
                        log.getResponseTimeMs(),
                        log.getOccurredAt()));

        return ResponseEntity.ok(page);
    }
}
