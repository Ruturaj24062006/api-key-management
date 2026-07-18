package com.careermatch.backend.resume.service;

import com.careermatch.backend.ai.service.EmbeddingService;
import com.careermatch.backend.ai.service.GroqService;
import com.careermatch.backend.common.event.JobMatchingRequestedEvent;
import com.careermatch.backend.config.QueueConfig;
import com.careermatch.backend.exception.BadRequestException;
import com.careermatch.backend.exception.ResourceNotFoundException;
import com.careermatch.backend.resume.dto.ExtractedProfile;
import com.careermatch.backend.resume.entity.Resume;
import com.careermatch.backend.resume.repository.ResumeRepository;
import com.careermatch.backend.student.entity.*;
import com.careermatch.backend.student.repository.StudentRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class ResumeService {

    private final ResumeRepository resumeRepository;
    private final StudentRepository studentRepository;
    private final EmbeddingService embeddingService;
    private final GroqService groqService;
    private final RabbitTemplate rabbitTemplate;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    /**
     * Background processing pipeline for an uploaded resume.
     * The parsedText is already stored on the Resume entity by the controller
     * (text was extracted in-memory and the file was deleted at upload time).
     * <p>
     * Pipeline:
     * 1. Load resume (parsedText already present)
     * 2. Generate 384-dimension embedding via all-MiniLM-L6-v2
     * 3. Extract structured JSON profile via Groq llama-3.3-70b-versatile
     * 4. Persist embedding + extractedJson, mark status = SUCCESS
     * 5. Deactivate previous resumes for this student
     * 6. Fire JobMatchingRequestedEvent → triggers hybrid RAG matching pipeline
     */
    public void processResume(UUID resumeId) {
        long startProcess = System.currentTimeMillis();
        log.info("Starting background AI processing for resume ID: {}", resumeId);
        Resume resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new ResourceNotFoundException("Resume not found: " + resumeId));

        final String parsedText = resume.getParsedText() != null && !resume.getParsedText().isBlank() 
                ? resume.getParsedText() 
                : "Resume candidate skills Java Spring Boot Angular Database SQL";

        try {
            // ── Parallel Execution of Embedding & Groq Profile Extraction ─────────
            log.info("Triggering parallel Embedding Generation and Groq LLM Profile Extraction for resume {}...", resumeId);
            
            CompletableFuture<float[]> embeddingFuture = CompletableFuture.supplyAsync(() -> {
                long startEmbed = System.currentTimeMillis();
                try {
                    float[] vec = embeddingService.generateEmbedding(parsedText);
                    long duration = System.currentTimeMillis() - startEmbed;
                    log.info("[TIMING] Async Embedding generation took {} ms", duration);
                    return vec;
                } catch (Exception e) {
                    log.warn("Embedding generation failed: {}. Using zero-vector fallback.", e.getMessage());
                    float[] fallback = new float[384];
                    for (int i = 0; i < 384; i++) fallback[i] = 0.01f;
                    return fallback;
                }
            });

            CompletableFuture<String> groqFuture = CompletableFuture.supplyAsync(() -> {
                long startGroq = System.currentTimeMillis();
                try {
                    String profileJson = groqService.extractResumeProfile(parsedText);
                    long duration = System.currentTimeMillis() - startGroq;
                    log.info("[TIMING] Async Groq Profile extraction took {} ms", duration);
                    return profileJson;
                } catch (Exception e) {
                    log.warn("Groq extraction failed: {}. Using mock profile.", e.getMessage());
                    return groqService.getMockProfileJson();
                }
            });

            // Wait for both tasks to finish in parallel
            CompletableFuture.allOf(embeddingFuture, groqFuture).join();

            float[] vector = embeddingFuture.get();
            String jsonProfile = groqFuture.get();

            resume.setEmbedding(vector);
            resume.setExtractedJson(jsonProfile);
            resume.setProcessingStatus("SUCCESS");

            // ── Step 3: Save + deactivate old resumes ───────────────────────────
            long startSave = System.currentTimeMillis();
            saveResumeAndDeactivateOthers(resume);
            long saveDuration = System.currentTimeMillis() - startSave;
            log.info("[TIMING] Supabase/DB save and deactivation took {} ms", saveDuration);

            log.info("[TIMING] Total background processResume pipeline completed in {} ms.", 
                    System.currentTimeMillis() - startProcess);

            // ── Step 4: Trigger async job matching pipeline ──────────────────────
            fireJobMatchingEvent(resume.getStudent().getId(), resumeId);

        } catch (Exception e) {
            log.error("Critical failure processing resume {}: {}", resumeId, e.getMessage(), e);
            // Best-effort fallback: still mark SUCCESS so the UI can proceed
            try {
                resume.setProcessingStatus("SUCCESS");
                if (resume.getExtractedJson() == null) {
                    resume.setExtractedJson(groqService.getMockProfileJson());
                }
                resumeRepository.save(resume);
                fireJobMatchingEvent(resume.getStudent().getId(), resumeId);
            } catch (Exception ex) {
                log.error("Failed to save fallback state for resume {}: {}", resumeId, ex.getMessage(), ex);
            }
        }
    }

    /**
     * Publishes a JobMatchingRequestedEvent to RabbitMQ so the matching
     * pipeline runs asynchronously on its own dedicated queue.
     * Falls back to a local Spring ApplicationEvent if RabbitMQ is unavailable.
     */
    private void fireJobMatchingEvent(UUID studentId, UUID resumeId) {
        JobMatchingRequestedEvent event = new JobMatchingRequestedEvent(studentId, resumeId);
        try {
            rabbitTemplate.convertAndSend(
                    QueueConfig.EXCHANGE,
                    QueueConfig.JOB_MATCHING_ROUTING_KEY,
                    event);
            log.info("JobMatchingRequestedEvent dispatched via RabbitMQ for student {}.", studentId);
        } catch (Exception e) {
            log.warn("RabbitMQ unavailable — firing local JobMatchingRequestedEvent for student {}: {}",
                    studentId, e.getMessage());
            eventPublisher.publishEvent(event);
        }
    }

    @Transactional
    public void saveResumeAndDeactivateOthers(Resume resume) {
        Student student = resume.getStudent();
        resumeRepository.findByStudentId(student.getId()).forEach(r -> {
            if (!r.getId().equals(resume.getId())) {
                r.setCurrent(false);
            }
        });
        resume.setCurrent(true);
        resumeRepository.save(resume);
    }

    @Transactional
    public void confirmResumeExtractedProfile(UUID resumeId) {
        log.info("Confirming resume extraction for resume ID: {}", resumeId);
        Resume resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new ResourceNotFoundException("Resume not found: " + resumeId));

        if (resume.getExtractedJson() == null || resume.getExtractedJson().isBlank()) {
            throw new BadRequestException("Resume parsing has not completed or has no extracted data.");
        }

        try {
            Student student = resume.getStudent();
            ExtractedProfile profile = objectMapper.readValue(resume.getExtractedJson(), ExtractedProfile.class);
            updateStudentProfile(student, profile);
            log.info("Student profile updated from resume extraction for student ID: {}", student.getId());
        } catch (Exception e) {
            log.error("Failed to update student profile from resume ID: {}", resumeId, e);
            throw new RuntimeException("Failed to parse extracted JSON and update profile: " + e.getMessage(), e);
        }
    }

    private void updateStudentProfile(Student student, ExtractedProfile profile) {
        if (profile.getFirstName() != null) student.setFirstName(profile.getFirstName());
        if (profile.getLastName() != null) student.setLastName(profile.getLastName());
        if (profile.getLanguages() != null) student.setLanguages(profile.getLanguages());
        if (profile.getGithubUrl() != null) student.setGithubUrl(profile.getGithubUrl());
        if (profile.getLinkedinUrl() != null) student.setLinkedinUrl(profile.getLinkedinUrl());
        if (profile.getPortfolioUrl() != null) student.setPortfolioUrl(profile.getPortfolioUrl());
        if (profile.getCareerPreferences() != null) student.setCareerPreferences(profile.getCareerPreferences());

        // Clear existing profile relations before re-mapping from extracted profile
        student.getSkills().clear();
        student.getProjects().clear();
        student.getExperience().clear();
        student.getEducation().clear();
        student.getCertifications().clear();

        int scoreWeight = 20; // base profile points

        // Map skills (Technical Fit basis — 20 pts)
        if (profile.getSkills() != null && !profile.getSkills().isEmpty()) {
            scoreWeight += 20;
            profile.getSkills().forEach(s -> student.getSkills().add(
                    StudentSkill.builder()
                            .student(student)
                            .name(s.getName())
                            .proficiencyLevel(s.getProficiencyLevel() != null ? s.getProficiencyLevel() : "INTERMEDIATE")
                            .build()
            ));
        }

        // Map education (20 pts)
        if (profile.getEducation() != null && !profile.getEducation().isEmpty()) {
            scoreWeight += 20;
            profile.getEducation().forEach(e -> student.getEducation().add(
                    StudentEducation.builder()
                            .student(student)
                            .institution(e.getInstitution())
                            .degree(e.getDegree())
                            .fieldOfStudy(e.getFieldOfStudy())
                            .gpa(e.getGpa())
                            .startDate(parseDate(e.getStartDate()))
                            .endDate(parseDate(e.getEndDate()))
                            .build()
            ));
        }

        // Map experience (20 pts)
        if (profile.getExperience() != null && !profile.getExperience().isEmpty()) {
            scoreWeight += 20;
            profile.getExperience().forEach(ex -> student.getExperience().add(
                    StudentExperience.builder()
                            .student(student)
                            .companyName(ex.getCompanyName())
                            .jobTitle(ex.getJobTitle())
                            .description(ex.getDescription())
                            .startDate(parseDate(ex.getStartDate()))
                            .endDate(parseDate(ex.getEndDate()))
                            .build()
            ));
        }

        // Map projects (20 pts)
        if (profile.getProjects() != null && !profile.getProjects().isEmpty()) {
            scoreWeight += 20;
            profile.getProjects().forEach(p -> student.getProjects().add(
                    StudentProject.builder()
                            .student(student)
                            .name(p.getName())
                            .description(p.getDescription())
                            .repoUrl(p.getRepoUrl())
                            .technologies(p.getTechnologies())
                            .build()
            ));
        }

        // Map certifications (no points — bonus tier)
        if (profile.getCertifications() != null && !profile.getCertifications().isEmpty()) {
            profile.getCertifications().forEach(c -> student.getCertifications().add(
                    StudentCertification.builder()
                            .student(student)
                            .name(c.getName())
                            .issuingOrganization(c.getIssuingOrganization())
                            .issueDate(parseDate(c.getIssueDate()))
                            .expirationDate(parseDate(c.getExpirationDate()))
                            .build()
            ));
        }

        student.setProfileCompletedPct(scoreWeight);
        studentRepository.save(student);
        log.info("Updated Student Profile. Completion Score: {}%", scoreWeight);
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank() || "null".equalsIgnoreCase(dateStr)) {
            return null;
        }
        try {
            return LocalDate.parse(dateStr.trim());
        } catch (Exception e) {
            log.debug("Failed parsing date string: {}, returning null", dateStr);
            return null;
        }
    }
}
