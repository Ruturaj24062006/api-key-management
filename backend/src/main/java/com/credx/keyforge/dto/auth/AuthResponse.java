package com.credx.keyforge.dto.auth;

public record AuthResponse(
        String token,
        String userId,
        String email,
        String fullName,
        String role
) {
}
