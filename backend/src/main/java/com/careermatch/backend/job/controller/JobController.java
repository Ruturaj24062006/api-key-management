package com.careermatch.backend.job.controller;

import com.careermatch.backend.common.ApiResponse;
import com.careermatch.backend.ai.service.GroqService;
import com.careermatch.backend.job.dto.JobRequest;
import com.careermatch.backend.job.dto.JobResponse;
import com.careermatch.backend.job.entity.Job;
import com.careermatch.backend.job.service.JobService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/jobs")
@RequiredArgsConstructor
@Tag(name = "Job Management", description = "Endpoints for posting, editing, listing, and closing job offers")
public class JobController {

    private final JobService jobService;
    private final GroqService groqService;

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_RECRUITER')")
    @Operation(summary = "Post a new job and trigger AI matching index update")
    public ResponseEntity<ApiResponse<JobResponse>> createJob(@Valid @RequestBody JobRequest request) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Job job = jobService.createJob(request, email);
        return ResponseEntity.ok(ApiResponse.success("Job created successfully", mapToResponse(job)));
    }

    @PutMapping("/{jobId}")
    @PreAuthorize("hasAuthority('ROLE_RECRUITER')")
    @Operation(summary = "Update an existing job detail and rebuild embeddings")
    public ResponseEntity<ApiResponse<JobResponse>> editJob(@PathVariable("jobId") UUID jobId, @Valid @RequestBody JobRequest request) {
        Job job = jobService.editJob(jobId, request);
        return ResponseEntity.ok(ApiResponse.success("Job updated successfully", mapToResponse(job)));
    }

    @DeleteMapping("/{jobId}")
    @PreAuthorize("hasAuthority('ROLE_RECRUITER')")
    @Operation(summary = "Remove a job posting from the system (ownership validated)")
    public ResponseEntity<ApiResponse<String>> deleteJob(@PathVariable("jobId") UUID jobId) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        jobService.deleteJob(jobId, email);
        return ResponseEntity.ok(ApiResponse.success("Job deleted successfully", "Deleted"));
    }

    @PatchMapping("/{jobId}/status")
    @PreAuthorize("hasAuthority('ROLE_RECRUITER')")
    @Operation(summary = "Change job status: DRAFT | ACTIVE | PAUSED | CLOSED")
    public ResponseEntity<ApiResponse<JobResponse>> updateJobStatus(
            @PathVariable("jobId") UUID jobId,
            @RequestBody Map<String, String> body
    ) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        String newStatus = body.getOrDefault("status", "");
        Job job = jobService.updateJobStatus(jobId, newStatus, email);
        return ResponseEntity.ok(ApiResponse.success("Job status updated to " + newStatus, mapToResponse(job)));
    }

    @GetMapping("/{jobId}")
    @Operation(summary = "Get detailed information of a job offer")
    public ResponseEntity<ApiResponse<JobResponse>> getJob(@PathVariable("jobId") UUID jobId) {
        Job job = jobService.getJobById(jobId);
        return ResponseEntity.ok(ApiResponse.success(mapToResponse(job)));
    }

    @GetMapping
    @Operation(summary = "List all published jobs")
    public ResponseEntity<ApiResponse<List<JobResponse>>> getPublishedJobs() {
        List<Job> jobs = jobService.getAllPublishedJobs();
        List<JobResponse> response = jobs.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(response));
    }
    @GetMapping("/my")
    @PreAuthorize("hasAuthority('ROLE_RECRUITER')")
    @Operation(summary = "Get all jobs posted by the current recruiter's company")
    public ResponseEntity<ApiResponse<List<JobResponse>>> getMyJobs() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        List<Job> jobs = jobService.getJobsByRecruiter(email);
        List<JobResponse> response = jobs.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/ai-assist")
    @PreAuthorize("hasAuthority('ROLE_RECRUITER')")
    @Operation(summary = "Use AI to auto-generate job description, skills and experience from a brief role prompt")
    public ResponseEntity<ApiResponse<String>> aiAssistJob(@RequestBody Map<String, String> body) {
        String prompt = body.getOrDefault("prompt", "");
        String result = groqService.generateJobDetails(prompt);
        return ResponseEntity.ok(ApiResponse.success("AI generation complete", result));
    }

    private JobResponse mapToResponse(Job job) {
        return JobResponse.builder()
                .id(job.getId())
                .companyName(job.getCompany().getName())
                .title(job.getTitle())
                .description(job.getDescription())
                .requirements(job.getRequirements())
                .location(job.getLocation())
                .jobType(job.getJobType().name())
                .experienceLevel(job.getExperienceLevel())
                .salaryRange(job.getSalaryRange())
                .requiredSkills(job.getRequiredSkills())
                .preferredSkills(job.getPreferredSkills())
                .workMode(job.getWorkMode())
                .educationLevel(job.getEducationLevel())
                .sponsorshipAvailable(job.getSponsorshipAvailable())
                .status(job.getStatus().name())
                .createdAt(job.getCreatedAt())
                .build();
    }
}
