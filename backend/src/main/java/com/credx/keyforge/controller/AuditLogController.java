package com.credx.keyforge.controller;

import com.credx.keyforge.dto.auditlog.AuditLogResponse;
import com.credx.keyforge.security.CurrentUserProvider;
import com.credx.keyforge.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogService auditLogService;
    private final CurrentUserProvider currentUserProvider;

    @GetMapping("/api/organizations/{organizationId}/audit-logs")
    public ResponseEntity<Page<AuditLogResponse>> getAuditLogs(
            @PathVariable String organizationId,
            @PageableDefault(size = 20) Pageable pageable) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.ok(auditLogService.getAuditLogs(userId, organizationId, pageable));
    }
}
