package com.careermatch.backend.matching.service;

import com.careermatch.backend.ai.service.EmbeddingService;
import com.careermatch.backend.job.entity.Job;
import com.careermatch.backend.job.entity.JobStatus;
import com.careermatch.backend.job.repository.JobRepository;
import com.careermatch.backend.resume.entity.Resume;
import com.careermatch.backend.resume.repository.ResumeRepository;
import com.careermatch.backend.student.entity.Student;
import com.careermatch.backend.student.entity.StudentSkill;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SearchService {

    private final JobRepository jobRepository;
    private final ResumeRepository resumeRepository;
    private final EmbeddingService embeddingService;

    /**
     * Hybrid RAG search for top matching jobs for a given student.
     *
     * Algorithm:
     *   - Primary: Uses successful Resume embedding vector & parsed text.
     *   - Fallback: If resume is missing or failed parsing, generates vector directly from Student Profile.
     *   - Sparse leg: PostgreSQL tsvector BM25 full-text search (top-100)
     *   - Fusion: Reciprocal Rank Fusion (k=60) in SQL
     */
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW, readOnly = true)
    public List<Job> searchJobsForStudent(Student student, int limit) {
        long tStart = System.currentTimeMillis();
        Resume resume = resumeRepository.findByStudentIdAndIsCurrentTrue(student.getId())
                .orElse(null);

        boolean isResumeValid = resume != null 
                && "SUCCESS".equalsIgnoreCase(resume.getProcessingStatus()) 
                && resume.getEmbedding() != null;

        float[] embeddingVector;
        if (isResumeValid) {
            log.info("[RAG_PIPELINE][STAGE 7] Using primary source (Resume embedding from structured profile) for student {}", student.getId());
            embeddingVector = resume.getEmbedding();
        } else {
            log.warn("[RAG_PIPELINE][STAGE 7] Resume missing/failed for student {}. Using Profile fallback for vector generation.", student.getId());
            String profileText = buildProfileText(student);
            embeddingVector = embeddingService.generateEmbedding(profileText);
        }

        // Build rich BM25 keywords combining profile and resume
        String keywords = buildKeywordString(student, isResumeValid ? resume : null);

        if (keywords.isBlank()) {
            log.warn("[RAG_PIPELINE][STAGE 8] Student {} has no skills/resume keywords — returning all active jobs.", student.getId());
            return jobRepository.findByStatus(JobStatus.ACTIVE);
        }

        String vectorStr = com.careermatch.backend.common.converter.PgVectorConverter.toVectorString(embeddingVector);

        log.info("[RAG_PIPELINE][STAGE 7-9] Executing PostgreSQL Hybrid Search (pgvector + BM25 tsvector + RRF k=60) for student {} | keywords: '{}'",
                student.getId(), keywords);

        List<Job> results;
        try {
            results = jobRepository.searchHybrid(vectorStr, keywords, limit);
            log.info("[RAG_PIPELINE][STAGE 9] Hybrid RRF search returned {} candidate jobs in {} ms",
                    results.size(), System.currentTimeMillis() - tStart);
        } catch (Exception e) {
            log.warn("[RAG_PIPELINE][STAGE 9] Hybrid RRF search failed ({} ms): {}. Falling back to active jobs list.",
                    System.currentTimeMillis() - tStart, e.getMessage());
            results = jobRepository.findByStatus(JobStatus.ACTIVE);
        }

        if (results.isEmpty()) {
            log.info("[RAG_PIPELINE][STAGE 9] Hybrid search yielded 0 results. Fallback to all active jobs.");
            results = jobRepository.findByStatus(JobStatus.ACTIVE);
        }

        return results;
    }


    private String buildProfileText(Student student) {
        StringBuilder sb = new StringBuilder();
        if (student.getSkills() != null && !student.getSkills().isEmpty()) {
            sb.append("Skills: ").append(student.getSkills().stream().map(StudentSkill::getName).collect(Collectors.joining(", "))).append(". ");
        }
        if (student.getExperience() != null && !student.getExperience().isEmpty()) {
            sb.append("Experience: ");
            for (var exp : student.getExperience()) {
                if (exp.getJobTitle() != null) sb.append(exp.getJobTitle()).append(" ");
                if (exp.getCompanyName() != null) sb.append(exp.getCompanyName()).append(" ");
                if (exp.getDescription() != null) sb.append(exp.getDescription()).append(". ");
            }
        }
        if (student.getProjects() != null && !student.getProjects().isEmpty()) {
            sb.append("Projects: ");
            for (var proj : student.getProjects()) {
                if (proj.getName() != null) sb.append(proj.getName()).append(" ");
                if (proj.getTechnologies() != null) sb.append(proj.getTechnologies()).append(" ");
                if (proj.getDescription() != null) sb.append(proj.getDescription()).append(". ");
            }
        }
        if (student.getEducation() != null && !student.getEducation().isEmpty()) {
            sb.append("Education: ");
            for (var edu : student.getEducation()) {
                if (edu.getDegree() != null) sb.append(edu.getDegree()).append(" ");
                if (edu.getFieldOfStudy() != null) sb.append(edu.getFieldOfStudy()).append(" ");
                if (edu.getInstitution() != null) sb.append(edu.getInstitution()).append(". ");
            }
        }
        if (student.getCertifications() != null && !student.getCertifications().isEmpty()) {
            sb.append("Certifications: ");
            for (var cert : student.getCertifications()) {
                if (cert.getName() != null) sb.append(cert.getName()).append(" ");
            }
        }
        if (student.getCareerPreferences() != null && !student.getCareerPreferences().isBlank()) {
            sb.append("Preferences: ").append(student.getCareerPreferences()).append(". ");
        }
        if (student.getBio() != null && !student.getBio().isBlank()) {
            sb.append("Bio: ").append(student.getBio());
        }
        return sb.toString().trim();
    }

    private static final Set<String> STOP_WORDS = Set.of(
            "a", "an", "the", "and", "or", "in", "of", "to", "for", "with", "on", "at", "by", "from",
            "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
            "but", "if", "not", "no", "as", "into", "like", "through", "after", "over", "between", "out",
            "this", "that", "these", "those", "my", "your", "his", "her", "its", "our", "their"
    );

    private String buildKeywordString(Student student, Resume resume) {
        Set<String> tokens = new java.util.LinkedHashSet<>();

        // Source 1: explicit skill tags
        if (student.getSkills() != null && !student.getSkills().isEmpty()) {
            for (StudentSkill skill : student.getSkills()) {
                if (skill.getName() != null) {
                    addCleanTokens(tokens, skill.getName());
                }
            }
        }

        // Source 2: experience job titles & descriptions
        if (student.getExperience() != null && !student.getExperience().isEmpty()) {
            for (var exp : student.getExperience()) {
                if (exp.getJobTitle() != null) addCleanTokens(tokens, exp.getJobTitle());
                if (exp.getDescription() != null) addCleanTokens(tokens, exp.getDescription());
            }
        }

        // Source 3: projects technologies & names
        if (student.getProjects() != null && !student.getProjects().isEmpty()) {
            for (var proj : student.getProjects()) {
                if (proj.getTechnologies() != null) addCleanTokens(tokens, proj.getTechnologies());
                if (proj.getName() != null) addCleanTokens(tokens, proj.getName());
            }
        }

        // Source 4: education degree & field of study
        if (student.getEducation() != null && !student.getEducation().isEmpty()) {
            for (var edu : student.getEducation()) {
                if (edu.getFieldOfStudy() != null) addCleanTokens(tokens, edu.getFieldOfStudy());
                if (edu.getDegree() != null) addCleanTokens(tokens, edu.getDegree());
            }
        }

        // Source 5: career preferences
        if (student.getCareerPreferences() != null && !student.getCareerPreferences().isBlank()) {
            addCleanTokens(tokens, student.getCareerPreferences());
        }

        // Source 6: first 512 chars of parsed resume text (if resume parsing succeeded)
        if (resume != null && resume.getParsedText() != null && !resume.getParsedText().isBlank()) {
            String text = resume.getParsedText();
            if (text.length() > 512) {
                text = text.substring(0, 512);
            }
            addCleanTokens(tokens, text);
        }

        if (tokens.isEmpty() && student.getBio() != null && !student.getBio().isBlank()) {
            addCleanTokens(tokens, student.getBio());
        }
        if (tokens.isEmpty()) {
            tokens.add("software");
            tokens.add("developer");
            tokens.add("engineer");
        }

        return String.join(" OR ", tokens);
    }

    private void addCleanTokens(Set<String> set, String raw) {
        if (raw == null || raw.isBlank()) return;
        String[] words = raw.replaceAll("[^a-zA-Z0-9 ]", " ").toLowerCase().split("\\s+");
        for (String w : words) {
            String trimmed = w.trim();
            if (trimmed.length() >= 2 && !STOP_WORDS.contains(trimmed)) {
                set.add(trimmed);
            }
        }
    }
}

