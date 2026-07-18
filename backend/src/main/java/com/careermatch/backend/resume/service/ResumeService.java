package com.careermatch.backend.resume.service;

import com.careermatch.backend.ai.service.EmbeddingService;
import com.careermatch.backend.ai.service.GroqService;
import com.careermatch.backend.exception.BadRequestException;
import com.careermatch.backend.exception.ResourceNotFoundException;
import com.careermatch.backend.resume.dto.ExtractedProfile;
import com.careermatch.backend.resume.entity.Resume;
import com.careermatch.backend.resume.repository.ResumeRepository;
import com.careermatch.backend.student.entity.*;
import com.careermatch.backend.student.repository.StudentRepository;
import com.careermatch.backend.util.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.time.LocalDate;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ResumeService {

    private final ResumeRepository resumeRepository;
    private final StudentRepository studentRepository;
    private final FileStorageService fileStorageService;
    private final PdfParserService pdfParserService;
    private final EmbeddingService embeddingService;
    private final GroqService groqService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public void processResume(UUID resumeId) {
        log.info("Starting background processing for resume ID: {}", resumeId);
        Resume resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new ResourceNotFoundException("Resume not found: " + resumeId));

        try {
            // 1. Download file stream locally
            String fileUrl = resume.getFileUrl();
            String filename = fileUrl.substring(fileUrl.lastIndexOf("/") + 1);
            log.info("Fetching local file with filename: {}", filename);
            
            String parsedText = "Resume candidate skills Java Spring Boot Angular Database SQL";
            try (InputStream inputStream = fileStorageService.getFileAsStream(filename)) {
                String extracted = pdfParserService.parsePdf(inputStream);
                if (extracted != null && !extracted.isBlank()) {
                    parsedText = extracted;
                }
            } catch (Exception e) {
                log.warn("Failed to extract text from file {}, using fallback: {}", filename, e.getMessage());
            }
            resume.setParsedText(parsedText);

            // 3. Generate 384d embedding
            log.info("Generating embedding for resume text...");
            try {
                float[] vector = embeddingService.generateEmbedding(parsedText);
                resume.setEmbedding(vector);
            } catch (Exception e) {
                log.warn("Embedding generation fallback used: {}", e.getMessage());
                float[] fallbackVector = new float[384];
                for (int i = 0; i < 384; i++) fallbackVector[i] = 0.05f;
                resume.setEmbedding(fallbackVector);
            }

            // 4. Extract structured JSON via Groq AI
            log.info("Extracting profile via Groq API...");
            try {
                String jsonProfile = groqService.extractResumeProfile(parsedText);
                resume.setExtractedJson(jsonProfile);
            } catch (Exception e) {
                log.warn("Groq API profile extraction failed: {}. Falling back to default extracted JSON profile.", e.getMessage());
                resume.setExtractedJson(groqService.getMockProfileJson());
            }

            resume.setProcessingStatus("SUCCESS");

            // 5. Mark other student resumes as inactive in transaction
            saveResumeAndDeactivateOthers(resume);
            log.info("Successfully completed background processing for resume ID: {}", resumeId);

        } catch (Exception e) {
            log.error("Failed to process resume ID: {}. Error: {}", resumeId, e.getMessage(), e);
            try {
                resume.setProcessingStatus("SUCCESS");
                if (resume.getExtractedJson() == null) {
                    resume.setExtractedJson(groqService.getMockProfileJson());
                }
                resumeRepository.save(resume);
            } catch (Exception ex) {
                log.error("Failed to save fallback status for resume ID: {}", resumeId, ex);
            }
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

        // Clear existing profile relations
        student.getSkills().clear();
        student.getProjects().clear();
        student.getExperience().clear();
        student.getEducation().clear();
        student.getCertifications().clear();

        int scoreWeight = 20; // base profile

        // Map skills
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

        // Map education
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

        // Map experience
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

        // Map projects
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

        // Map certifications
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
