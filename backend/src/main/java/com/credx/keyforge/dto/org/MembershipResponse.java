package com.credx.keyforge.dto.org;

import com.credx.keyforge.entity.MembershipRole;

import java.time.Instant;

public record MembershipResponse(
        String id,
        String userId,
        String userEmail,
        String userFullName,
        MembershipRole role,
        Instant joinedAt
) {
}
