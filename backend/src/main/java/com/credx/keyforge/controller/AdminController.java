package com.credx.keyforge.controller;

import com.credx.keyforge.dto.admin.UserMembershipSummary;
import com.credx.keyforge.dto.admin.UserSummaryResponse;
import com.credx.keyforge.dto.usage.PlatformUsageSummaryResponse;
import com.credx.keyforge.entity.OrganizationMembership;
import com.credx.keyforge.entity.User;
import com.credx.keyforge.repository.OrganizationMembershipRepository;
import com.credx.keyforge.repository.UserRepository;
import com.credx.keyforge.service.UsageAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UsageAnalyticsService usageAnalyticsService;
    private final UserRepository userRepository;
    private final OrganizationMembershipRepository membershipRepository;

    @GetMapping("/platform-usage-summary")
    public ResponseEntity<PlatformUsageSummaryResponse> platformUsageSummary() {
        return ResponseEntity.ok(usageAnalyticsService.getPlatformUsageSummary());
    }

    @GetMapping("/users")
    public ResponseEntity<List<UserSummaryResponse>> listUsers() {
        List<User> users = userRepository.findAll();
        List<OrganizationMembership> memberships = membershipRepository.findAll();

        Map<String, List<OrganizationMembership>> membershipsByUser = memberships.stream()
                .collect(Collectors.groupingBy(m -> m.getUser().getId()));

        List<UserSummaryResponse> response = users.stream().map(user -> {
            List<OrganizationMembership> userOrgs = membershipsByUser.getOrDefault(user.getId(), List.of());
            List<UserMembershipSummary> orgSummaries = userOrgs.stream().map(m -> new UserMembershipSummary(
                    m.getOrganization().getId(),
                    m.getOrganization().getName(),
                    m.getRole()
            )).toList();

            return new UserSummaryResponse(
                    user.getId(),
                    user.getEmail(),
                    user.getFullName(),
                    user.getRole(),
                    user.getCreatedAt(),
                    orgSummaries
            );
        }).toList();

        return ResponseEntity.ok(response);
    }
}
