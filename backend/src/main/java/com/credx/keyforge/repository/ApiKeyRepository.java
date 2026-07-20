package com.credx.keyforge.repository;

import com.credx.keyforge.entity.ApiKey;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ApiKeyRepository extends JpaRepository<ApiKey, String> {

    Page<ApiKey> findAllByProjectId(String projectId, Pageable pageable);

    List<ApiKey> findAllByProjectId(String projectId);

    /**
     * Looks up candidate keys sharing a visible prefix. Prefixes are NOT unique
     * (they're short, e.g. "kf_live_ab12"), so callers must still verify the
     * hashed secret against every candidate returned here before trusting one.
     */
    List<ApiKey> findAllByKeyPrefix(String keyPrefix);

    Optional<ApiKey> findByHashedKey(String hashedKey);

    long countByStatus(com.credx.keyforge.entity.ApiKeyStatus status);

    long countByProjectIdAndStatus(String projectId, com.credx.keyforge.entity.ApiKeyStatus status);

    @Query("select k from ApiKey k join fetch k.project p join fetch p.organization o join fetch o.owner where k.id = :id")
    Optional<ApiKey> findWithOrgDetailsById(@Param("id") String id);

    @Modifying
    @Query("update ApiKey k set k.lastUsedAt = :now where k.id = :id")
    void touchLastUsedAt(@Param("id") String id, @Param("now") java.time.Instant now);
}
