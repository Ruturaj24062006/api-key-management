package com.credx.keyforge.repository;

import com.credx.keyforge.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, String> {
    // TODO: add findAllByOrganizationIdOrderByCreatedAtDesc(String orgId, Pageable pageable)
    // once the audit log read API (AuditLogController) is built out.
}
