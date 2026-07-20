package com.credx.keyforge.dto.admin;

import com.credx.keyforge.entity.MembershipRole;

public record UserMembershipSummary(
        String organizationId,
        String organizationName,
        MembershipRole role
) {}
