package com.credx.keyforge.controller;

import com.credx.keyforge.dto.apikey.ApiKeyCreatedResponse;
import com.credx.keyforge.dto.apikey.ApiKeyResponse;
import com.credx.keyforge.dto.apikey.CreateApiKeyRequest;
import com.credx.keyforge.security.CurrentUserProvider;
import com.credx.keyforge.service.ApiKeyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class ApiKeyController {

    private final ApiKeyService apiKeyService;
    private final CurrentUserProvider currentUserProvider;

    @PostMapping("/api/organizations/{organizationId}/projects/{projectId}/keys")
    public ResponseEntity<ApiKeyCreatedResponse> create(
            @PathVariable String organizationId,
            @PathVariable String projectId,
            @Valid @RequestBody CreateApiKeyRequest request) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.status(HttpStatus.CREATED).body(
                apiKeyService.createApiKey(userId, organizationId, projectId, request));
    }

    @GetMapping("/api/organizations/{organizationId}/projects/{projectId}/keys")
    public ResponseEntity<Page<ApiKeyResponse>> list(
            @PathVariable String organizationId,
            @PathVariable String projectId,
            @PageableDefault(size = 20) Pageable pageable) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.ok(apiKeyService.listApiKeys(userId, organizationId, projectId, pageable));
    }

    /**
     * Fetches a key by id directly (used by the key detail panel and the
     * revoke confirmation dialog). Scoped only by apiKeyId - the frontend
     * always reaches this from a key it already has in the current project's
     * list, so organizationId isn't threaded through here.
     */
    @GetMapping("/api/keys/{apiKeyId}")
    public ResponseEntity<ApiKeyResponse> get(@PathVariable String apiKeyId) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.ok(apiKeyService.getApiKey(userId, apiKeyId));
    }

    @PostMapping("/api/keys/{apiKeyId}/revoke")
    public ResponseEntity<Void> revoke(@PathVariable String apiKeyId) {
        String userId = currentUserProvider.getUserId();
        apiKeyService.revokeApiKey(userId, apiKeyId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/keys/{apiKeyId}/rotate")
    public ResponseEntity<ApiKeyCreatedResponse> rotate(@PathVariable String apiKeyId) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(
                apiKeyService.rotateApiKey(userId, apiKeyId));
    }
}
