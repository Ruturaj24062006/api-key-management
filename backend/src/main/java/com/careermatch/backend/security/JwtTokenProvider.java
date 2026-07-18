package com.careermatch.backend.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.security.MessageDigest;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Component
public class JwtTokenProvider {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.accessTokenExpirationMs}")
    private long jwtExpirationMs;

    @Value("${app.jwt.refreshTokenExpirationMs}")
    private long jwtRefreshExpirationMs;

    private Key getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes();
        if (keyBytes.length < 32) {
            try {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                keyBytes = digest.digest(keyBytes);
            } catch (Exception e) {
                // Ignore fallback
            }
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String extractUsername(String token) {
        Claims claims = extractAllClaims(token);
        String email = claims.get("email", String.class);
        return email != null ? email : claims.getSubject();
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public String extractRole(String token) {
        Claims claims = extractAllClaims(token);
        // 1. Check custom claim "role"
        String role = claims.get("role", String.class);
        if (role != null) {
            if (!role.startsWith("ROLE_")) {
                role = "ROLE_" + role.toUpperCase();
            }
            return role;
        }
        // 2. Check user_metadata map
        Map<?, ?> metadata = claims.get("user_metadata", Map.class);
        if (metadata != null && metadata.get("role") != null) {
            String metaRole = metadata.get("role").toString();
            if (!metaRole.startsWith("ROLE_")) {
                metaRole = "ROLE_" + metaRole.toUpperCase();
            }
            return metaRole;
        }
        // Default fallback to STUDENT role
        return "ROLE_STUDENT";
    }

    public boolean validateTokenSignatureAndExpiry(String token) {
        try {
            return !isTokenExpired(token);
        } catch (Exception e) {
            return false;
        }
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    private Boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    public String generateToken(UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", userDetails.getAuthorities().iterator().next().getAuthority());
        return createToken(claims, userDetails.getUsername(), jwtExpirationMs);
    }

    public String generateToken(String email, String role, java.util.UUID userId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("email", email);
        claims.put("role", role.startsWith("ROLE_") ? role : "ROLE_" + role.toUpperCase());
        claims.put("userId", userId != null ? userId.toString() : null);
        return createToken(claims, email, jwtExpirationMs);
    }

    public String generateRefreshToken(UserDetails userDetails) {
        return createToken(new HashMap<>(), userDetails.getUsername(), jwtRefreshExpirationMs);
    }

    public String generateRefreshToken(String email, String role, java.util.UUID userId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("email", email);
        claims.put("role", role.startsWith("ROLE_") ? role : "ROLE_" + role.toUpperCase());
        claims.put("userId", userId != null ? userId.toString() : null);
        return createToken(claims, email, jwtRefreshExpirationMs);
    }

    private String createToken(Map<String, Object> claims, String subject, long expirationMs) {
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(subject)
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public Boolean validateToken(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return (username.equals(userDetails.getUsername()) && !isTokenExpired(token));
    }
}
