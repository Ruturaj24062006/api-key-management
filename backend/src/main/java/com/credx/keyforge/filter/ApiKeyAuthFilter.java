package com.credx.keyforge.filter;

import com.credx.keyforge.entity.ApiKey;
import com.credx.keyforge.service.ApiKeyValidationService;
import com.credx.keyforge.service.UsageLoggingService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;

/**
 * Guards the simulated "protected resource" demo endpoint. Requires a valid
 * X-API-Key header, resolves it to an ApiKey, and records a usage log entry
 * for every call - this is the whole point of the platform: showing what
 * happens when a generated key is actually used against something.
 *
 * NOTE: this filter records usage and tracks the rate-limit counter, but does
 * NOT reject requests once the limit is exceeded yet - enforcement is a
 * planned follow-up (see README "Missing Features"). Right now going over the
 * configured rateLimitPerMinute just shows up in the counter.
 */
@Component
@RequiredArgsConstructor
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    private static final String API_KEY_HEADER = "X-API-Key";
    private static final String PROTECTED_PATH = "/api/demo/protected-resource";

    private final ApiKeyValidationService validationService;
    private final UsageLoggingService usageLoggingService;
    private final ObjectMapper objectMapper;

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !request.getRequestURI().startsWith(PROTECTED_PATH);
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        long start = System.currentTimeMillis();
        String presentedKey = request.getHeader(API_KEY_HEADER);

        Optional<ApiKey> resolved = validationService.resolveKey(presentedKey);

        if (resolved.isEmpty()) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "Missing or invalid API key");
            return;
        }

        ApiKey apiKey = resolved.get();
        boolean withinLimit = validationService.recordRequestAndCheckLimit(apiKey);

        // withinLimit is currently informational only - see class javadoc.
        // A future rate-limit filter should short-circuit here with 429 when
        // withinLimit is false.

        filterChain.doFilter(request, response);

        long elapsed = System.currentTimeMillis() - start;
        usageLoggingService.recordUsage(
                apiKey,
                request.getRequestURI(),
                request.getMethod(),
                response.getStatus(),
                elapsed);
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write(objectMapper.writeValueAsString(Map.of(
                "status", status,
                "error", "UNAUTHORIZED",
                "message", message)));
    }
}
