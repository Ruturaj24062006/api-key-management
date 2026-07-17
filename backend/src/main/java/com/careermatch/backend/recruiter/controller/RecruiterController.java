package com.careermatch.backend.recruiter.controller;

import com.careermatch.backend.common.ApiResponse;
import com.careermatch.backend.recruiter.dto.RecruiterDashboardStatsResponse;
import com.careermatch.backend.recruiter.dto.RecruiterOnboardRequest;
import com.careermatch.backend.recruiter.dto.RecruiterProfileResponse;
import com.careermatch.backend.recruiter.service.RecruiterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/recruiters")
@RequiredArgsConstructor
@Tag(name = "Recruiter Management", description = "Endpoints for managing recruiter and company profiles")
public class RecruiterController {

    private final RecruiterService recruiterService;

    @GetMapping("/profile")
    @PreAuthorize("hasAuthority('ROLE_RECRUITER')")
    @Operation(summary = "Get the current recruiter's profile details")
    public ResponseEntity<ApiResponse<RecruiterProfileResponse>> getProfile() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        RecruiterProfileResponse response = recruiterService.getRecruiterProfile(email);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAuthority('ROLE_RECRUITER')")
    @Operation(summary = "Get dashboard stats: active jobs, total applications, shortlisted, interviews")
    public ResponseEntity<ApiResponse<RecruiterDashboardStatsResponse>> getDashboardStats() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        RecruiterDashboardStatsResponse response = recruiterService.getDashboardStats(email);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/onboard")
    @PreAuthorize("hasAuthority('ROLE_RECRUITER')")
    @Operation(summary = "Submit company profile and recruiter onboarding details")
    public ResponseEntity<ApiResponse<RecruiterProfileResponse>> onboard(
            @Valid @RequestBody RecruiterOnboardRequest request
    ) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        RecruiterProfileResponse response = recruiterService.onboardRecruiter(email, request);
        return ResponseEntity.ok(ApiResponse.success("Onboarding submitted successfully", response));
    }

    @PostMapping("/verify")
    @PreAuthorize("hasAuthority('ROLE_RECRUITER')")
    @Operation(summary = "Simulate email/company verification status (sets verified to true)")
    public ResponseEntity<ApiResponse<String>> verifyRecruiter() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        recruiterService.verifyRecruiter(email);
        return ResponseEntity.ok(ApiResponse.success("Recruiter verification succeeded", "VERIFIED"));
    }
}
