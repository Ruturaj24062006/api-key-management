package com.credx.keyforge.service;

import com.credx.keyforge.dto.auditlog.AuditLogResponse;
import com.credx.keyforge.entity.AuditLog;
import com.credx.keyforge.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final OrganizationAccessService accessService;

    public Page<AuditLogResponse> getAuditLogs(String userId, String organizationId, Pageable pageable) {
        accessService.requireMembership(userId, organizationId);
        Page<AuditLog> page = auditLogRepository.findAllByOrganizationIdOrderByCreatedAtDesc(organizationId, pageable);
        return page.map(this::toResponse);
    }

    private AuditLogResponse toResponse(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getOrganizationId(),
                log.getActorUserId(),
                log.getActorEmail(),
                log.getAction(),
                log.getTargetType(),
                log.getTargetId(),
                log.getCreatedAt()
        );
    }
}
