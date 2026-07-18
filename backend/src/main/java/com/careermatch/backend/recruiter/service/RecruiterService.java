package com.careermatch.backend.recruiter.service;

import com.careermatch.backend.application.dto.ApplicationResponse;
import com.careermatch.backend.application.entity.Application;
import com.careermatch.backend.application.entity.ApplicationStatus;
import com.careermatch.backend.application.repository.ApplicationRepository;
import com.careermatch.backend.auth.entity.User;
import com.careermatch.backend.auth.repository.UserRepository;
import com.careermatch.backend.company.entity.Company;
import com.careermatch.backend.company.repository.CompanyRepository;
import com.careermatch.backend.exception.ResourceNotFoundException;
import com.careermatch.backend.job.entity.Job;
import com.careermatch.backend.job.entity.JobStatus;
import com.careermatch.backend.job.repository.JobRepository;
import com.careermatch.backend.recruiter.dto.RecruiterDashboardStatsResponse;
import com.careermatch.backend.recruiter.dto.RecruiterOnboardRequest;
import com.careermatch.backend.recruiter.dto.RecruiterProfileResponse;
import com.careermatch.backend.recruiter.entity.Recruiter;
import com.careermatch.backend.recruiter.repository.RecruiterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RecruiterService {

    private final UserRepository userRepository;
    private final RecruiterRepository recruiterRepository;
    private final CompanyRepository companyRepository;
    private final JobRepository jobRepository;
    private final ApplicationRepository applicationRepository;

    public RecruiterProfileResponse getRecruiterProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Recruiter recruiter = recruiterRepository.findById(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Recruiter profile not found"));

        return mapToResponse(recruiter, user.getEmail());
    }

    public RecruiterDashboardStatsResponse getDashboardStats(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Recruiter recruiter = recruiterRepository.findById(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Recruiter profile not found"));

        Company company = recruiter.getCompany();
        if (company == null) {
            return RecruiterDashboardStatsResponse.builder()
                    .activeJobs(0).totalApplications(0).shortlisted(0).interviews(0)
                    .recentApplications(List.of()).build();
        }

        List<Job> companyJobs = jobRepository.findByCompanyId(company.getId());
        List<UUID> jobIds = companyJobs.stream().map(Job::getId).collect(Collectors.toList());

        long activeJobs = companyJobs.stream()
                .filter(j -> j.getStatus() == JobStatus.ACTIVE)
                .count();

        List<Application> allApplications = jobIds.isEmpty()
                ? List.of()
                : applicationRepository.findByJobIdIn(jobIds);

        long shortlisted = allApplications.stream()
                .filter(a -> a.getStatus() == ApplicationStatus.SHORTLISTED)
                .count();
        long interviews = allApplications.stream()
                .filter(a -> a.getStatus() == ApplicationStatus.INTERVIEW)
                .count();

        List<ApplicationResponse> recent = allApplications.stream()
                .sorted(Comparator.comparing(Application::getCreatedAt).reversed())
                .limit(10)
                .map(this::mapAppToResponse)
                .collect(Collectors.toList());

        return RecruiterDashboardStatsResponse.builder()
                .activeJobs(activeJobs)
                .totalApplications(allApplications.size())
                .shortlisted(shortlisted)
                .interviews(interviews)
                .recentApplications(recent)
                .build();
    }

    @Transactional
    public RecruiterProfileResponse onboardRecruiter(String email, RecruiterOnboardRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Recruiter recruiter = recruiterRepository.findById(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Recruiter profile not found"));

        Company company = recruiter.getCompany();
        if (company == null) {
            company = companyRepository.findByNameIgnoreCase(request.getCompanyName())
                    .orElseGet(() -> companyRepository.save(
                            Company.builder()
                                    .name(request.getCompanyName())
                                    .build()
                    ));
        } else {
            company.setName(request.getCompanyName());
        }

        company.setLogoUrl(request.getLogoUrl());
        company.setWebsiteUrl(request.getWebsiteUrl());
        company.setIndustry(request.getIndustry());
        company.setLocation(request.getLocation());
        company.setDescription(request.getDescription());
        company.setVerified(true);
        Company savedCompany = companyRepository.save(company);

        recruiter.setCompany(savedCompany);
        recruiter.setJobTitle(request.getJobTitle());
        recruiter.setVerified(true);
        Recruiter savedRecruiter = recruiterRepository.save(recruiter);

        return mapToResponse(savedRecruiter, user.getEmail());
    }

    @Transactional
    public void verifyRecruiter(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Recruiter recruiter = recruiterRepository.findById(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Recruiter profile not found"));

        recruiter.setVerified(true);
        if (recruiter.getCompany() != null) {
            recruiter.getCompany().setVerified(true);
            companyRepository.save(recruiter.getCompany());
        }
        recruiterRepository.save(recruiter);
    }

    private ApplicationResponse mapAppToResponse(Application app) {
        String studentName = (app.getStudent().getFirstName() != null ? app.getStudent().getFirstName() : "") + " " +
                (app.getStudent().getLastName() != null ? app.getStudent().getLastName() : "");
        return ApplicationResponse.builder()
                .id(app.getId())
                .jobId(app.getJob().getId())
                .studentId(app.getStudent().getId())
                .jobTitle(app.getJob().getTitle())
                .companyName(app.getJob().getCompany().getName())
                .studentName(studentName.trim())
                .resumeUrl(app.getResume() != null ? app.getResume().getFileUrl() : null)
                .status(app.getStatus().name())
                .coverLetter(app.getCoverLetter())
                .feedback(app.getFeedback())
                .createdAt(app.getCreatedAt())
                .build();
    }

    private RecruiterProfileResponse mapToResponse(Recruiter recruiter, String email) {
        Company company = recruiter.getCompany();
        return RecruiterProfileResponse.builder()
                .id(recruiter.getId())
                .email(email)
                .jobTitle(recruiter.getJobTitle())
                .isVerified(recruiter.isVerified())
                .companyId(company != null ? company.getId() : null)
                .companyName(company != null ? company.getName() : null)
                .logoUrl(company != null ? company.getLogoUrl() : null)
                .websiteUrl(company != null ? company.getWebsiteUrl() : null)
                .industry(company != null ? company.getIndustry() : null)
                .location(company != null ? company.getLocation() : null)
                .description(company != null ? company.getDescription() : null)
                .build();
    }
}
