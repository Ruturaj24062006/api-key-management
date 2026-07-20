package com.credx.keyforge.service;

import com.credx.keyforge.dto.org.CreateOrganizationRequest;
import com.credx.keyforge.dto.org.InviteMemberRequest;
import com.credx.keyforge.dto.org.MembershipResponse;
import com.credx.keyforge.dto.org.OrganizationResponse;
import com.credx.keyforge.entity.MembershipRole;
import com.credx.keyforge.entity.Organization;
import com.credx.keyforge.entity.OrganizationMembership;
import com.credx.keyforge.entity.PlanTier;
import com.credx.keyforge.entity.User;
import com.credx.keyforge.exception.DuplicateResourceException;
import com.credx.keyforge.exception.ResourceNotFoundException;
import com.credx.keyforge.repository.OrganizationMembershipRepository;
import com.credx.keyforge.repository.OrganizationRepository;
import com.credx.keyforge.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final OrganizationAccessService accessService;

    @Transactional
    public OrganizationResponse createOrganization(String userId, CreateOrganizationRequest request) {
        User owner = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        String slug = slugify(request.name());
        if (organizationRepository.existsBySlug(slug)) {
            slug = slug + "-" + System.currentTimeMillis() % 10000;
        }

        Organization org = Organization.builder()
                .name(request.name().trim())
                .slug(slug)
                .planTier(PlanTier.FREE)
                .owner(owner)
                .build();
        org = organizationRepository.save(org);

        OrganizationMembership membership = OrganizationMembership.builder()
                .user(owner)
                .organization(org)
                .role(MembershipRole.OWNER)
                .build();
        membershipRepository.save(membership);

        return toResponse(org, MembershipRole.OWNER);
    }

    public List<OrganizationResponse> listOrganizationsForUser(String userId) {
        return membershipRepository.findAllByUserIdWithOrganization(userId).stream()
                .map(m -> toResponse(m.getOrganization(), m.getRole()))
                .toList();
    }

    public OrganizationResponse getOrganization(String userId, String organizationId) {
        OrganizationMembership membership = accessService.requireMembership(userId, organizationId);
        return toResponse(membership.getOrganization(), membership.getRole());
    }

    @Transactional
    public MembershipResponse inviteMember(String actingUserId, String organizationId, InviteMemberRequest request) {
        accessService.requireRole(actingUserId, organizationId, MembershipRole.OWNER, MembershipRole.ADMIN);

        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));

        User invitee = userRepository.findByEmail(request.email().trim().toLowerCase())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No KeyForge account found for that email - ask them to register first"));

        if (membershipRepository.existsByUserIdAndOrganizationId(invitee.getId(), organizationId)) {
            throw new DuplicateResourceException("User is already a member of this organization");
        }

        OrganizationMembership membership = OrganizationMembership.builder()
                .user(invitee)
                .organization(org)
                .role(request.role())
                .build();
        membership = membershipRepository.save(membership);

        return new MembershipResponse(
                membership.getId(),
                invitee.getId(),
                invitee.getEmail(),
                invitee.getFullName(),
                membership.getRole(),
                membership.getJoinedAt());
    }

    public List<MembershipResponse> listMembers(String userId, String organizationId) {
        accessService.requireMembership(userId, organizationId);

        return membershipRepository.findAllByOrganizationId(organizationId).stream()
                .map(m -> new MembershipResponse(
                        m.getId(),
                        m.getUser().getId(),
                        m.getUser().getEmail(),
                        m.getUser().getFullName(),
                        m.getRole(),
                        m.getJoinedAt()))
                .toList();
    }

    private OrganizationResponse toResponse(Organization org, MembershipRole currentUserRole) {
        return new OrganizationResponse(
                org.getId(),
                org.getName(),
                org.getSlug(),
                org.getPlanTier(),
                org.getOwner().getId(),
                currentUserRole.name(),
                org.getCreatedAt());
    }

    private String slugify(String name) {
        return name.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
    }
}
