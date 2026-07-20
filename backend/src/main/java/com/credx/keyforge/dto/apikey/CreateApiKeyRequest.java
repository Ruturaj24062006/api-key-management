package com.credx.keyforge.dto.apikey;

import com.credx.keyforge.entity.Scope;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public record CreateApiKeyRequest(
        @NotBlank @Size(min = 2, max = 100) String name,

        @NotEmpty(message = "At least one scope must be selected")
        List<Scope> scopes,

        /**
         * Optional expiry. When null, the key never expires. When present it
         * must be in the future - enforced client-side by the Angular date
         * picker's [min] binding. Kept as a plain Instant here (no @Future)
         * since Bean Validation's clock and the client's local timezone can
         * disagree by a few seconds around the boundary and we don't want
         * spurious 400s from that.
         */
        Instant expiresAt,

        @NotNull
        @Max(value = 10000, message = "Rate limit cannot exceed 10000 requests/minute")
        Integer rateLimitPerMinute
) {
}
