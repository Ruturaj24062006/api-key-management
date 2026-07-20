package com.credx.keyforge.util;

import com.credx.keyforge.entity.Environment;
import org.springframework.stereotype.Component;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Generates cryptographically random API keys and hashes them for storage.
 * Format: kf_{live|test}_{visiblePrefixChars}{restOfSecret}
 * Only the first few chars after the env segment are ever persisted in
 * plaintext (as ApiKey.keyPrefix), purely for display/identification in the UI.
 */
@Component
public class ApiKeyGenerator {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int SECRET_BYTES = 32;
    private static final int VISIBLE_PREFIX_CHARS = 8;

    public record GeneratedKey(String fullKey, String keyPrefix, String hashedKey) {}

    public GeneratedKey generate(Environment environment) {
        String envSegment = environment == Environment.PRODUCTION ? "live" : "test";
        byte[] randomBytes = new byte[SECRET_BYTES];
        SECURE_RANDOM.nextBytes(randomBytes);
        String secret = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        String fullKey = "kf_" + envSegment + "_" + secret;
        String visiblePrefix = "kf_" + envSegment + "_" + secret.substring(0, VISIBLE_PREFIX_CHARS);
        String hashed = sha256(fullKey);

        return new GeneratedKey(fullKey, visiblePrefix, hashed);
    }

    public String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    /**
     * Compares a candidate plaintext key against a stored hash.
     * Hashes the candidate and compares the resulting digest strings.
     */
    public boolean matches(String candidatePlainKey, String storedHash) {
        String candidateHash = sha256(candidatePlainKey);
        return candidateHash.equals(storedHash);
    }
}
