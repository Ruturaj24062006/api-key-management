package com.credx.keyforge.service;

import com.credx.keyforge.entity.ApiKey;
import com.credx.keyforge.entity.ApiKeyStatus;
import com.credx.keyforge.repository.ApiKeyRepository;
import com.credx.keyforge.util.ApiKeyGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Validates an incoming "X-API-Key" header against stored keys and tracks
 * per-minute usage for rate limiting. Used by ApiKeyAuthFilter on every call
 * to the simulated protected resource endpoint.
 */
@Service
@RequiredArgsConstructor
public class ApiKeyValidationService {

    private final ApiKeyRepository apiKeyRepository;
    private final ApiKeyGenerator apiKeyGenerator;

    /**
     * Resolves a presented plaintext key to its ApiKey record.
     *
     * The visible prefix (e.g. "kf_live_ab12") is short by design - it's meant
     * only for display/identification in the dashboard, not as a lookup key on
     * its own. Because prefixes could collide across a large enough key
     * population, every candidate returned by the prefix lookup is re-checked
     * against the full hashed secret below before being trusted.
     */
    @Transactional(readOnly = true)
    public Optional<ApiKey> resolveKey(String presentedKey) {
        if (presentedKey == null || presentedKey.isBlank() || presentedKey.length() < 12) {
            return Optional.empty();
        }

        String prefixSegment = presentedKey.length() >= 16 ? presentedKey.substring(0, 16) : presentedKey;
        List<ApiKey> candidates = apiKeyRepository.findAllByKeyPrefix(prefixSegment);

        if (candidates.isEmpty()) {
            // Fall back to a direct hash lookup in case the prefix table lookup
            // missed (e.g. prefix length mismatch) - this still requires the
            // full key to match a stored hash exactly.
            String hashed = apiKeyGenerator.sha256(presentedKey);
            return apiKeyRepository.findByHashedKey(hashed).filter(this::isUsable);
        }

        String hashed = apiKeyGenerator.sha256(presentedKey);
        return candidates.stream()
                .filter(k -> apiKeyGenerator.matches(presentedKey, k.getHashedKey()) || k.getHashedKey().equals(hashed))
                .filter(this::isUsable)
                .findFirst();
    }

    private boolean isUsable(ApiKey key) {
        if (key.getStatus() != ApiKeyStatus.ACTIVE) {
            return false;
        }
        return key.getExpiresAt() == null || key.getExpiresAt().isAfter(Instant.now());
    }

    /**
     * Increments the current-minute request counter and reports whether the
     * key is still within its configured rate limit. Resets the window when a
     * new minute has started.
     */
    @Transactional
    public boolean recordRequestAndCheckLimit(ApiKey key) {
        Instant now = Instant.now();

        if (key.getCurrentWindowStart() == null ||
                now.isAfter(key.getCurrentWindowStart().plusSeconds(60))) {
            key.setCurrentWindowStart(now);
            key.setCurrentWindowCount(0);
        }

        int currentCount = key.getCurrentWindowCount();
        int updatedCount = currentCount + 1;
        key.setCurrentWindowCount(updatedCount);
        key.setLastUsedAt(now);
        apiKeyRepository.save(key);

        return updatedCount <= key.getRateLimitPerMinute();
    }
}
