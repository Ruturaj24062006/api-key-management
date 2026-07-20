package com.credx.keyforge.dto.admin;

import com.credx.keyforge.entity.Role;
import java.time.Instant;
import java.util.List;

public record UserSummaryResponse(
        String id,
        String email,
        String fullName,
        Role role,
        Instant createdAt,
        List<UserMembershipSummary> memberships
) {}
