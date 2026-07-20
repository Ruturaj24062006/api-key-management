package com.credx.keyforge.dto.apikey;

/**
 * Returned ONLY once, immediately after key creation. `fullKey` is the
 * plaintext secret - it is never persisted and can never be retrieved again
 * after this response is sent.
 */
public record ApiKeyCreatedResponse(
        ApiKeyResponse apiKey,
        String fullKey
) {
}
