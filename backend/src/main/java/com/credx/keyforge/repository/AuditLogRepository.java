package com.credx.keyforge.repository;

import com.credx.keyforge.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AuditLogRepository extends JpaRepository<AuditLog, String> {
    Page<AuditLog> findAllByOrganizationIdOrderByCreatedAtDesc(String organizationId, Pageable pageable);
}
