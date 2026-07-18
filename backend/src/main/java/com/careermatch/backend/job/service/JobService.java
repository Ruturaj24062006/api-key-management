package com.careermatch.backend.job.service;

import com.careermatch.backend.ai.service.EmbeddingService;
import com.careermatch.backend.auth.entity.User;
import com.careermatch.backend.auth.repository.UserRepository;
import com.careermatch.backend.common.event.JobPostedEvent;
import com.careermatch.backend.config.QueueConfig;
import com.careermatch.backend.exception.BadRequestException;
import com.careermatch.backend.exception.ResourceNotFoundException;
import com.careermatch.backend.job.dto.JobRequest;
import com.careermatch.backend.job.entity.Job;
import com.careermatch.backend.job.entity.JobStatus;
import com.careermatch.backend.job.repository.JobRepository;
import com.careermatch.backend.recruiter.entity.Recruiter;
import com.careermatch.backend.recruiter.repository.RecruiterRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class JobService {

    private final JobRepository jobRepository;
    private final RecruiterRepository recruiterRepository;
    private final UserRepository userRepository;
    private final EmbeddingService embeddingService;
    private final RabbitTemplate rabbitTemplate;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public Job createJob(JobRequest request, String recruiterEmail) {
        User user = userRepository.findByEmail(recruiterEmail)
                .orElseThrow(() -> new BadRequestException("Recruiter user not found"));

        Recruiter recruiter = recruiterRepository.findById(user.getId())
                .orElseThrow(() -> new BadRequestException("Recruiter profile not initialized"));

        if (recruiter.getCompany() == null) {
            throw new BadRequestException("Recruiter must be associated with a company to post jobs");
        }

        // Generate embedding for Job search context (fail-safe)
        String context = (request.getTitle() != null ? request.getTitle() : "") + " " +
                (request.getDescription() != null ? request.getDescription() : "") + " " +
                (request.getRequirements() != null ? request.getRequirements() : "");
        float[] vector;
        try {
            vector = embeddingService.generateEmbedding(context);
        } catch (Exception e) {
            log.warn("Failed to generate AI embedding for job context. Defaulting to zero vector: {}", e.getMessage());
            vector = new float[384];
        }

        Job job = Job.builder()
                .recruiter(recruiter)
                .company(recruiter.getCompany())
                .title(request.getTitle())
                .description(request.getDescription())
                .requirements(request.getRequirements())
                .location(request.getLocation())
                .jobType(request.getJobType())
                .experienceLevel(request.getExperienceLevel())
                .salaryRange(request.getSalaryRange())
                .requiredSkills(request.getRequiredSkills())
                .preferredSkills(request.getPreferredSkills())
                .workMode(request.getWorkMode())
                .educationLevel(request.getEducationLevel())
                .sponsorshipAvailable(request.getSponsorshipAvailable())
                .department(request.getDepartment())
                .gpaCutoff(request.getGpaCutoff())
                .deadline(request.getDeadline())
                .status(JobStatus.ACTIVE) // Default to active on creation
                .embedding(vector)
                .build();

        Job saved;
        try {
            saved = jobRepository.save(job);
            log.info("Posted job ID: {} by Recruiter: {} saved successfully.", saved.getId(), recruiter.getId());
        } catch (Exception e) {
            log.error("CRITICAL: Failed to save the job posting to PostgreSQL: {}", e.getMessage(), e);
            throw e;
        }

        // Dispatch JobPostedEvent to trigger match updates for all students (fail-safe)
        JobPostedEvent event = new JobPostedEvent(saved.getId(), recruiter.getCompany().getId());
        try {
            rabbitTemplate.convertAndSend(QueueConfig.EXCHANGE, QueueConfig.JOB_POSTED_ROUTING_KEY, event);
            log.info("JobPostedEvent dispatched via RabbitMQ for job ID: {}", saved.getId());
        } catch (Exception e) {
            log.warn("RabbitMQ not available. Falling back to local in-process event listener for job {}: {}", saved.getId(), e.getMessage());
            try {
                eventPublisher.publishEvent(event);
            } catch (Exception ex) {
                log.error("Failed to publish local fallback event for job {}: {}", saved.getId(), ex.getMessage());
            }
        }

        return saved;
    }

    @Transactional
    public Job editJob(UUID jobId, JobRequest request) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        job.setTitle(request.getTitle());
        job.setDescription(request.getDescription());
        job.setRequirements(request.getRequirements());
        job.setLocation(request.getLocation());
        job.setJobType(request.getJobType());
        job.setExperienceLevel(request.getExperienceLevel());
        job.setSalaryRange(request.getSalaryRange());
        job.setRequiredSkills(request.getRequiredSkills());
        job.setPreferredSkills(request.getPreferredSkills());
        job.setWorkMode(request.getWorkMode());
        job.setEducationLevel(request.getEducationLevel());
        job.setSponsorshipAvailable(request.getSponsorshipAvailable());
        job.setDepartment(request.getDepartment());
        job.setGpaCutoff(request.getGpaCutoff());
        job.setDeadline(request.getDeadline());

        // Re-generate embedding
        String context = request.getTitle() + " " + request.getDescription() + " " + request.getRequirements();
        float[] vector = embeddingService.generateEmbedding(context);
        job.setEmbedding(vector);

        return jobRepository.save(job);
    }

    @Transactional
    public void deleteJob(UUID jobId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));
        jobRepository.delete(job);
    }

    public Job getJobById(UUID jobId) {
        return jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));
    }

    public List<Job> getJobsByCompany(UUID companyId) {
        return jobRepository.findByCompanyId(companyId);
    }

    public List<Job> getAllPublishedJobs() {
        return jobRepository.findByStatus(JobStatus.ACTIVE);
    }

    public List<Job> getJobsByRecruiter(String recruiterEmail) {
        User user = userRepository.findByEmail(recruiterEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Recruiter recruiter = recruiterRepository.findById(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Recruiter not found"));
        if (recruiter.getCompany() == null) return List.of();
        return jobRepository.findByCompanyId(recruiter.getCompany().getId());
    }

    @Transactional
    public Job updateJobStatus(UUID jobId, String newStatus, String recruiterEmail) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        // Ownership check
        User user = userRepository.findByEmail(recruiterEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Recruiter recruiter = recruiterRepository.findById(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Recruiter not found"));
        if (recruiter.getCompany() == null || !job.getCompany().getId().equals(recruiter.getCompany().getId())) {
            throw new BadRequestException("You do not have permission to update this job.");
        }

        JobStatus targetStatus;
        try {
            targetStatus = JobStatus.valueOf(newStatus.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid status: " + newStatus + ". Allowed: DRAFT, ACTIVE, PAUSED, CLOSED");
        }

        job.setStatus(targetStatus);
        return jobRepository.save(job);
    }

    @Transactional
    public void deleteJob(UUID jobId, String recruiterEmail) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        User user = userRepository.findByEmail(recruiterEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Recruiter recruiter = recruiterRepository.findById(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Recruiter not found"));
        if (recruiter.getCompany() == null || !job.getCompany().getId().equals(recruiter.getCompany().getId())) {
            throw new BadRequestException("You do not have permission to delete this job.");
        }

        jobRepository.delete(job);
    }
}


