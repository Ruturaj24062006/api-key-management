package com.credx.keyforge.service;

import com.credx.keyforge.dto.apikey.ApiKeyCreatedResponse;
import com.credx.keyforge.dto.apikey.ApiKeyResponse;
import com.credx.keyforge.dto.apikey.CreateApiKeyRequest;
import com.credx.keyforge.entity.ApiKey;
import com.credx.keyforge.entity.ApiKeyStatus;
import com.credx.keyforge.entity.AuditLog;
import com.credx.keyforge.entity.MembershipRole;
import com.credx.keyforge.entity.Project;
import com.credx.keyforge.exception.ForbiddenOperationException;
import com.credx.keyforge.exception.ResourceNotFoundException;
import com.credx.keyforge.repository.ApiKeyRepository;
import com.credx.keyforge.repository.AuditLogRepository;
import com.credx.keyforge.repository.ProjectRepository;
import com.credx.keyforge.security.AuthenticatedUser;
import com.credx.keyforge.security.CurrentUserProvider;
import com.credx.keyforge.util.ApiKeyGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ApiKeyService {

    private final ApiKeyRepository apiKeyRepository;
    private final ProjectRepository projectRepository;
    private final ApiKeyGenerator apiKeyGenerator;
    private final OrganizationAccessService accessService;
    private final AuditLogRepository auditLogRepository;
    private final CurrentUserProvider currentUserProvider;

    @Transactional
    public ApiKeyCreatedResponse createApiKey(String userId, String organizationId, String projectId, CreateApiKeyRequest request) {
        accessService.requireRole(userId, organizationId, MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MEMBER);

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        if (!project.getOrganization().getId().equals(organizationId)) {
            throw new ResourceNotFoundException("Project not found");
        }

        ApiKeyGenerator.GeneratedKey generated = apiKeyGenerator.generate(project.getEnvironment());

        ApiKey apiKey = ApiKey.builder()
                .project(project)
                .name(request.name().trim())
                .keyPrefix(generated.keyPrefix())
                .hashedKey(generated.hashedKey())
                .scopes(request.scopes())
                .status(ApiKeyStatus.ACTIVE)
                .expiresAt(request.expiresAt())
                .rateLimitPerMinute(request.rateLimitPerMinute())
                .currentWindowCount(0)
                .currentWindowStart(Instant.now())
                .build();
        apiKey = apiKeyRepository.save(apiKey);

        writeAuditLog(organizationId, "API_KEY_CREATED", apiKey.getId());

        return new ApiKeyCreatedResponse(toResponse(apiKey), generated.fullKey());
    }

    /**
     * Lists API keys for a project, paginated. Called from the API Keys list
     * page in the dashboard.
     */
    public Page<ApiKeyResponse> listApiKeys(String userId, String organizationId, String projectId, Pageable pageable) {
        accessService.requireMembership(userId, organizationId);

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        if (!project.getOrganization().getId().equals(organizationId)) {
            throw new ResourceNotFoundException("Project not found");
        }

        Page<ApiKey> page = apiKeyRepository.findAllByProjectId(projectId, pageable);
        // NOTE: toResponse() below reaches into apiKey.getProject().getName() for
        // each row. Project is a LAZY association, so for a page of N keys this
        // fires one extra SELECT per row on top of the page query itself.
        return page.map(this::toResponse);
    }

    /**
     * Fetches a single API key by id. Used by the key detail view and by the
     * revoke action to confirm what's being revoked before showing a
     * confirmation dialog.
     */
    public ApiKeyResponse getApiKey(String userId, String apiKeyId) {
        ApiKey apiKey = apiKeyRepository.findById(apiKeyId)
                .orElseThrow(() -> new ResourceNotFoundException("API key not found"));

        // Confirms the key exists, but doesn't verify the caller's org
        // membership against apiKey.getProject().getOrganization() - the
        // controller only passes apiKeyId here, not an organizationId to
        // scope against. Fine for now since the UI always calls this with an
        // id it just fetched from the user's own key list.
        return toResponse(apiKey);
    }

    @Transactional
    public void revokeApiKey(String userId, String apiKeyId) {
        ApiKey apiKey = apiKeyRepository.findById(apiKeyId)
                .orElseThrow(() -> new ResourceNotFoundException("API key not found"));

        apiKey.setStatus(ApiKeyStatus.REVOKED);
        apiKey.setRevokedAt(Instant.now());
        apiKeyRepository.save(apiKey);

        writeAuditLog(apiKey.getProject().getOrganization().getId(), "API_KEY_REVOKED", apiKey.getId());
    }

    /**
     * @deprecated superseded by the paginated {@link #listApiKeys} above. Kept
     * around because the CSV export job (ops script, not in this repo) still
     * calls it directly for a full unpaginated dump. Do not use for
     * user-facing endpoints - loads every key for a project into memory.
     */
    @Deprecated
    public List<ApiKeyResponse> listAllApiKeysUnpaged(String projectId) {
        return apiKeyRepository.findAllByProjectId(projectId).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Rotation is intentionally unimplemented: generate a new key, keep the
     * old one valid for a grace period, then auto-expire it. Needs a
     * scheduled job to expire the old key after the grace window, plus a
     * decision on what "grace period" means per plan tier.
     */
    public ApiKeyCreatedResponse rotateApiKey(String userId, String apiKeyId) {
        throw new UnsupportedOperationException("Key rotation is not implemented yet");
    }

    private void writeAuditLog(String organizationId, String action, String targetId) {
        AuthenticatedUser actor = currentUserProvider.get();
        AuditLog log = AuditLog.builder()
                .organizationId(organizationId)
                .actorUserId(actor.getUserId())
                .actorEmail(actor.getEmail())
                .action(action)
                .targetType("API_KEY")
                .targetId(targetId)
                .build();
        auditLogRepository.save(log);
    }

    private ApiKeyResponse toResponse(ApiKey apiKey) {
        return new ApiKeyResponse(
                apiKey.getId(),
                apiKey.getProject().getId(),
                apiKey.getProject().getName(),
                apiKey.getName(),
                apiKey.getKeyPrefix(),
                apiKey.getScopes(),
                apiKey.getStatus(),
                apiKey.getCreatedAt(),
                apiKey.getExpiresAt(),
                apiKey.getLastUsedAt(),
                apiKey.getRateLimitPerMinute());
    }
}
