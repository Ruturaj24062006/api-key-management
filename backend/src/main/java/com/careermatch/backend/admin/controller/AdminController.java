package com.careermatch.backend.admin.controller;

import com.careermatch.backend.admin.dto.*;
import com.careermatch.backend.application.repository.ApplicationRepository;
import com.careermatch.backend.auth.entity.User;
import com.careermatch.backend.auth.repository.UserRepository;
import com.careermatch.backend.common.ApiResponse;
import com.careermatch.backend.company.entity.Company;
import com.careermatch.backend.company.repository.CompanyRepository;
import com.careermatch.backend.exception.ResourceNotFoundException;
import com.careermatch.backend.job.entity.Job;
import com.careermatch.backend.job.repository.JobRepository;
import com.careermatch.backend.recruiter.entity.Recruiter;
import com.careermatch.backend.recruiter.repository.RecruiterRepository;
import com.careermatch.backend.student.entity.Student;
import com.careermatch.backend.student.repository.StudentRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@Tag(name = "Admin System", description = "System administrator control board")
public class AdminController {

    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final RecruiterRepository recruiterRepository;
    private final CompanyRepository companyRepository;
    private final JobRepository jobRepository;
    private final ApplicationRepository applicationRepository;

    @GetMapping("/stats")
    @Operation(summary = "View high-level platform analytics metrics")
    public ResponseEntity<ApiResponse<AdminStatsResponse>> getPlatformStats() {
        AdminStatsResponse stats = AdminStatsResponse.builder()
                .studentCount(studentRepository.count())
                .recruiterCount(recruiterRepository.count())
                .companyCount(companyRepository.count())
                .jobCount(jobRepository.count())
                .applicationCount(applicationRepository.count())
                .build();
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    @GetMapping("/students")
    @Operation(summary = "Manage Students - Fetch all student profiles and accounts")
    public ResponseEntity<ApiResponse<List<AdminStudentResponse>>> getAllStudents() {
        List<Student> students = studentRepository.findAll();
        List<AdminStudentResponse> response = students.stream()
                .map(s -> AdminStudentResponse.builder()
                        .id(s.getId())
                        .firstName(s.getFirstName())
                        .lastName(s.getLastName())
                        .email(s.getUser().getEmail())
                        .suspended(s.getUser().isSuspended())
                        .build())
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/recruiters")
    @Operation(summary = "Manage Recruiters - Fetch all recruiter profiles")
    public ResponseEntity<ApiResponse<List<AdminRecruiterResponse>>> getAllRecruiters() {
        List<Recruiter> recruiters = recruiterRepository.findAll();
        List<AdminRecruiterResponse> response = recruiters.stream()
                .map(r -> AdminRecruiterResponse.builder()
                        .id(r.getId())
                        .email(r.getUser().getEmail())
                        .jobTitle(r.getJobTitle())
                        .companyName(r.getCompany() != null ? r.getCompany().getName() : "N/A")
                        .suspended(r.getUser().isSuspended())
                        .verified(r.isVerified())
                        .build())
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/users/{userId}/suspend")
    @Transactional
    @Operation(summary = "Suspend or reinstate user credentials")
    public ResponseEntity<ApiResponse<String>> toggleUserSuspension(@PathVariable("userId") UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        user.setSuspended(!user.isSuspended());
        userRepository.save(user);

        String action = user.isSuspended() ? "suspended" : "reactivated";
        return ResponseEntity.ok(ApiResponse.success("User successfully " + action, "Success"));
    }

    @GetMapping("/companies")
    @Operation(summary = "Verify Companies - Fetch all registered companies")
    public ResponseEntity<ApiResponse<List<AdminCompanyResponse>>> getAllCompanies() {
        List<Company> companies = companyRepository.findAll();
        List<AdminCompanyResponse> response = companies.stream()
                .map(c -> AdminCompanyResponse.builder()
                        .id(c.getId())
                        .name(c.getName())
                        .industry(c.getIndustry())
                        .location(c.getLocation())
                        .websiteUrl(c.getWebsiteUrl())
                        .verified(c.isVerified())
                        .build())
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/companies/{companyId}/verify")
    @Transactional
    @Operation(summary = "Verify a company and all its recruiters")
    public ResponseEntity<ApiResponse<String>> verifyCompany(@PathVariable("companyId") UUID companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company not found: " + companyId));

        company.setVerified(true);
        companyRepository.save(company);

        // Auto verify recruiters in this company
        List<Recruiter> recruiters = recruiterRepository.findByCompanyId(companyId);
        for (Recruiter r : recruiters) {
            r.setVerified(true);
            User u = r.getUser();
            if (u != null) {
                u.setVerified(true);
                userRepository.save(u);
            }
            recruiterRepository.save(r);
        }

        return ResponseEntity.ok(ApiResponse.success("Company and associated recruiters verified successfully", "Success"));
    }

    @GetMapping("/jobs")
    @Operation(summary = "Manage Jobs - Fetch all posted job listings")
    public ResponseEntity<ApiResponse<List<AdminJobResponse>>> getAllJobs() {
        List<Job> jobs = jobRepository.findAll();
        List<AdminJobResponse> response = jobs.stream()
                .map(j -> AdminJobResponse.builder()
                        .id(j.getId())
                        .title(j.getTitle())
                        .companyName(j.getCompany() != null ? j.getCompany().getName() : "N/A")
                        .workMode(j.getWorkMode() != null ? j.getWorkMode().name() : "N/A")
                        .location(j.getLocation())
                        .status(j.getStatus() != null ? j.getStatus().name() : "N/A")
                        .createdAt(j.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @DeleteMapping("/jobs/{jobId}")
    @Transactional
    @Operation(summary = "Remove a job post (e.g., fraudulent job listing)")
    public ResponseEntity<ApiResponse<String>> removeFraudulentJob(@PathVariable("jobId") UUID jobId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        jobRepository.delete(job);
        return ResponseEntity.ok(ApiResponse.success("Job post removed successfully", "Success"));
    }
}
