package com.credx.keyforge.controller;

import com.credx.keyforge.dto.apikey.ApiKeyResponse;
import com.credx.keyforge.service.ApiKeyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Small internal reporting surface used by the ops CSV export script.
 * Not linked from the main dashboard nav.
 */
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportsController {

    private final ApiKeyService apiKeyService;

    @GetMapping("/projects/{projectId}/keys/export")
    public ResponseEntity<List<ApiKeyResponse>> exportKeys(@PathVariable String projectId) {
        return ResponseEntity.ok(apiKeyService.listAllApiKeysUnpaged(projectId));
    }
}
