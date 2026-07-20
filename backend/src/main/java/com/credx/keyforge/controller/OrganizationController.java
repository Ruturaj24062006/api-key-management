package com.credx.keyforge.controller;

import com.credx.keyforge.dto.org.CreateOrganizationRequest;
import com.credx.keyforge.dto.org.InviteMemberRequest;
import com.credx.keyforge.dto.org.MembershipResponse;
import com.credx.keyforge.dto.org.OrganizationResponse;
import com.credx.keyforge.security.CurrentUserProvider;
import com.credx.keyforge.service.OrganizationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
public class OrganizationController {

    private final OrganizationService organizationService;
    private final CurrentUserProvider currentUserProvider;

    @PostMapping
    public ResponseEntity<OrganizationResponse> create(@Valid @RequestBody CreateOrganizationRequest request) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.status(HttpStatus.CREATED).body(organizationService.createOrganization(userId, request));
    }

    @GetMapping
    public ResponseEntity<List<OrganizationResponse>> list() {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.ok(organizationService.listOrganizationsForUser(userId));
    }

    @GetMapping("/{organizationId}")
    public ResponseEntity<OrganizationResponse> get(@PathVariable String organizationId) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.ok(organizationService.getOrganization(userId, organizationId));
    }

    @PostMapping("/{organizationId}/members")
    public ResponseEntity<MembershipResponse> invite(
            @PathVariable String organizationId,
            @Valid @RequestBody InviteMemberRequest request) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.status(HttpStatus.CREATED).body(
                organizationService.inviteMember(userId, organizationId, request));
    }

    @GetMapping("/{organizationId}/members")
    public ResponseEntity<List<MembershipResponse>> listMembers(@PathVariable String organizationId) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.ok(organizationService.listMembers(userId, organizationId));
    }
}
