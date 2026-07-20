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
    @Transactional(readOnly = true)
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
    @Transactional(readOnly = true)
    public ApiKeyResponse getApiKey(String userId, String apiKeyId) {
        ApiKey apiKey = apiKeyRepository.findById(apiKeyId)
                .orElseThrow(() -> new ResourceNotFoundException("API key not found"));

        String orgId = apiKey.getProject().getOrganization().getId();
        accessService.requireMembership(userId, orgId);

        return toResponse(apiKey);
    }

    @Transactional
    public void revokeApiKey(String userId, String apiKeyId) {
        ApiKey apiKey = apiKeyRepository.findById(apiKeyId)
                .orElseThrow(() -> new ResourceNotFoundException("API key not found"));

        String orgId = apiKey.getProject().getOrganization().getId();
        accessService.requireRole(userId, orgId, MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MEMBER);

        apiKey.setStatus(ApiKeyStatus.REVOKED);
        apiKey.setRevokedAt(Instant.now());
        apiKeyRepository.save(apiKey);

        writeAuditLog(orgId, "API_KEY_REVOKED", apiKey.getId());
    }

    /**
     * @deprecated superseded by the paginated {@link #listApiKeys} above. Kept
     * around because the CSV export job (ops script, not in this repo) still
     * calls it directly for a full unpaginated dump. Do not use for
     * user-facing endpoints - loads every key for a project into memory.
     */
    @Deprecated
    @Transactional(readOnly = true)
    public List<ApiKeyResponse> listAllApiKeysUnpaged(String projectId) {
        return apiKeyRepository.findAllByProjectId(projectId).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Rotates an existing API key: generates a new key with identical configuration,
     * while keeping the old key valid for a 24-hour grace period.
     */
    @Transactional
    public ApiKeyCreatedResponse rotateApiKey(String userId, String apiKeyId) {
        ApiKey oldKey = apiKeyRepository.findById(apiKeyId)
                .orElseThrow(() -> new ResourceNotFoundException("API key not found"));

        String orgId = oldKey.getProject().getOrganization().getId();
        accessService.requireRole(userId, orgId, MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MEMBER);

        if (oldKey.getStatus() != ApiKeyStatus.ACTIVE) {
            throw new ForbiddenOperationException("Only active API keys can be rotated");
        }

        // Keep old key valid for a 24-hour grace period
        oldKey.setExpiresAt(Instant.now().plusSeconds(86400));
        apiKeyRepository.save(oldKey);

        // Generate new API key
        Project project = oldKey.getProject();
        ApiKeyGenerator.GeneratedKey generated = apiKeyGenerator.generate(project.getEnvironment());

        ApiKey newKey = ApiKey.builder()
                .project(project)
                .name(oldKey.getName())
                .keyPrefix(generated.keyPrefix())
                .hashedKey(generated.hashedKey())
                .scopes(oldKey.getScopes())
                .status(ApiKeyStatus.ACTIVE)
                .expiresAt(null)
                .rateLimitPerMinute(oldKey.getRateLimitPerMinute())
                .currentWindowCount(0)
                .currentWindowStart(Instant.now())
                .build();
        newKey = apiKeyRepository.save(newKey);

        writeAuditLog(orgId, "API_KEY_ROTATED", newKey.getId());

        return new ApiKeyCreatedResponse(toResponse(newKey), generated.fullKey());
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
