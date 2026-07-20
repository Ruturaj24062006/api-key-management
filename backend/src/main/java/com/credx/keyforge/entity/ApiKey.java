package com.credx.keyforge.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "api_keys", indexes = {
        @Index(name = "idx_api_keys_prefix", columnList = "key_prefix"),
        @Index(name = "idx_api_keys_project", columnList = "project_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApiKey {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(nullable = false)
    private String name;

    /** Visible portion shown in the UI, e.g. "kf_live_ab12". Safe to display/log. */
    @Column(name = "key_prefix", nullable = false, length = 20)
    private String keyPrefix;

    /** SHA-256 hash of the full secret key. The plaintext key is never stored. */
    @Column(name = "hashed_key", nullable = false, unique = true)
    private String hashedKey;

    @ElementCollection(targetClass = Scope.class, fetch = FetchType.EAGER)
    @CollectionTable(name = "api_key_scopes", joinColumns = @JoinColumn(name = "api_key_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "scope")
    @Builder.Default
    private List<Scope> scopes = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ApiKeyStatus status = ApiKeyStatus.ACTIVE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "rate_limit_per_minute", nullable = false)
    @Builder.Default
    private Integer rateLimitPerMinute = 60;

    /**
     * Current-minute request counter used for rate-limit accounting.
     * Reset each minute by the bucket window below. Read-modify-write today;
     * see UsageTrackingService for how it's updated.
     */
    @Column(name = "current_window_count", nullable = false)
    @Builder.Default
    private Integer currentWindowCount = 0;

    @Column(name = "current_window_start")
    private Instant currentWindowStart;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
