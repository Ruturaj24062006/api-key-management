package com.credx.keyforge.dto.org;

import com.credx.keyforge.entity.MembershipRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record InviteMemberRequest(
        @NotBlank @Email String email,
        @NotNull MembershipRole role
) {
}
