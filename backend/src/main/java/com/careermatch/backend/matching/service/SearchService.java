package com.careermatch.backend.matching.service;

import com.careermatch.backend.job.entity.Job;
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
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SearchService {

    private final JobRepository jobRepository;
    private final ResumeRepository resumeRepository;

    /**
     * Hybrid RAG search for top matching jobs for a given student.
     *
     * Algorithm:
     *   - Dense leg: pgvector cosine similarity on resume embedding (top-100)
     *   - Sparse leg: PostgreSQL tsvector BM25 full-text search (top-100)
     *   - Fusion:     Reciprocal Rank Fusion (k=60) in SQL
     *
     * @param student the student to match jobs for
     * @param limit   maximum number of candidate jobs to return (use 100 for best RRF coverage)
     * @return ranked list of candidate Job entities
     */
    public List<Job> searchJobsForStudent(Student student, int limit) {
        Resume resume = resumeRepository.findByStudentIdAndIsCurrentTrue(student.getId())
                .orElse(null);

        // Build a rich BM25 keyword string from multiple sources for high recall
        String keywords = buildKeywordString(student, resume);

        if (resume == null || resume.getEmbedding() == null) {
            log.warn("No active resume or embedding found for student: {}. Falling back to FTS-only search.", student.getId());

            if (keywords.isBlank()) {
                log.warn("Student {} has no skills or resume text — returning empty job list.", student.getId());
                return Collections.emptyList();
            }

            // Dense leg: zero vector (pgvector will still rank by BM25 via RRF)
            float[] zeroVector = new float[384];
            log.info("FTS-only hybrid search for student {} with keywords: '{}'", student.getId(), keywords);
            return jobRepository.searchHybrid(zeroVector, keywords, limit);
        }

        log.info("Performing hybrid RRF search (top {}) for student {} | keywords: '{}'",
                limit, student.getId(), keywords);
        return jobRepository.searchHybrid(resume.getEmbedding(), keywords, limit);
    }

    private static final java.util.Set<String> STOP_WORDS = java.util.Set.of(
            "a", "an", "the", "and", "or", "in", "of", "to", "for", "with", "on", "at", "by", "from",
            "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
            "but", "if", "not", "no", "as", "into", "like", "through", "after", "over", "between", "out",
            "this", "that", "these", "those", "my", "your", "his", "her", "its", "our", "their"
    );

    /**
     * Builds a rich BM25 query keyword string combining:
     * 1. Skill entity names (most precise)
     * 2. Job titles from experience (domain context)
     * 3. Lead tokens from parsed resume text (broad recall)
     *
     * Tokens are deduplicated, cleaned of stop words, and joined with " OR "
     * for disjunctive Cover Density (BM25) scoring via websearch_to_tsquery().
     */
    private String buildKeywordString(Student student, Resume resume) {
        java.util.Set<String> tokens = new java.util.LinkedHashSet<>();

        // Source 1: explicit skill tags
        if (student.getSkills() != null && !student.getSkills().isEmpty()) {
            for (StudentSkill skill : student.getSkills()) {
                if (skill.getName() != null) {
                    addCleanTokens(tokens, skill.getName());
                }
            }
        }

        // Source 2: experience job titles (adds domain context like "backend", "engineer")
        if (student.getExperience() != null && !student.getExperience().isEmpty()) {
            for (var exp : student.getExperience()) {
                if (exp.getJobTitle() != null) {
                    addCleanTokens(tokens, exp.getJobTitle());
                }
            }
        }

        // Source 3: first 512 chars of parsed resume text (highest raw recall)
        if (resume != null && resume.getParsedText() != null && !resume.getParsedText().isBlank()) {
            String text = resume.getParsedText();
            if (text.length() > 512) {
                text = text.substring(0, 512);
            }
            addCleanTokens(tokens, text);
        }

        // Fallback if tokens set is empty
        if (tokens.isEmpty() && student.getBio() != null && !student.getBio().isBlank()) {
            addCleanTokens(tokens, student.getBio());
        }
        if (tokens.isEmpty()) {
            tokens.add("software");
            tokens.add("developer");
            tokens.add("engineer");
        }

        // Format for websearch_to_tsquery with OR operators for BM25 cover density scoring
        return String.join(" OR ", tokens);
    }

    private void addCleanTokens(java.util.Set<String> set, String raw) {
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
