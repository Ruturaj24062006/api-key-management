package com.credx.keyforge.repository;

import com.credx.keyforge.entity.ApiKeyUsageLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface ApiKeyUsageLogRepository extends JpaRepository<ApiKeyUsageLog, String> {

    Page<ApiKeyUsageLog> findAllByApiKeyIdOrderByOccurredAtDesc(String apiKeyId, Pageable pageable);

    List<ApiKeyUsageLog> findAllByApiKeyIdAndOccurredAtAfter(String apiKeyId, Instant after);

    long countByApiKeyIdAndOccurredAtAfter(String apiKeyId, Instant after);

    long countByApiKeyIdAndOccurredAtAfterAndStatusCodeGreaterThanEqual(
            String apiKeyId, Instant after, Integer statusCode);

    @Query("select count(u) from ApiKeyUsageLog u where u.apiKey.project.id = :projectId and u.occurredAt >= :since")
    long countByProjectIdSince(@Param("projectId") String projectId, @Param("since") Instant since);
}
