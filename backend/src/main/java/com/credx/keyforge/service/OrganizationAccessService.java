package com.credx.keyforge.service;

import com.credx.keyforge.entity.MembershipRole;
import com.credx.keyforge.entity.OrganizationMembership;
import com.credx.keyforge.exception.ForbiddenOperationException;
import com.credx.keyforge.repository.OrganizationMembershipRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Central place for "does this user have access to this org, and at what
 * role" checks. Controllers/services that touch org-scoped resources
 * (projects, API keys) should route through here rather than re-implementing
 * membership checks inline.
 */
@Service
@RequiredArgsConstructor
public class OrganizationAccessService {

    private final OrganizationMembershipRepository membershipRepository;

    public OrganizationMembership requireMembership(String userId, String organizationId) {
        return membershipRepository.findByUserIdAndOrganizationId(userId, organizationId)
                .orElseThrow(() -> new ForbiddenOperationException(
                        "You are not a member of this organization"));
    }

    public void requireRole(String userId, String organizationId, MembershipRole... allowedRoles) {
        OrganizationMembership membership = requireMembership(userId, organizationId);
        boolean allowed = List.of(allowedRoles).contains(membership.getRole());
        if (!allowed) {
            throw new ForbiddenOperationException("Your role does not permit this action");
        }
    }

    public boolean isMember(String userId, String organizationId) {
        return membershipRepository.existsByUserIdAndOrganizationId(userId, organizationId);
    }
}
