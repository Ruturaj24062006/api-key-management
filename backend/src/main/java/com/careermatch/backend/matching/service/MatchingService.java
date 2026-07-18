package com.careermatch.backend.matching.service;

import com.careermatch.backend.ai.service.GroqService;
import com.careermatch.backend.exception.ResourceNotFoundException;
import com.careermatch.backend.job.entity.Job;
import com.careermatch.backend.job.entity.JobStatus;
import com.careermatch.backend.job.repository.JobRepository;
import com.careermatch.backend.matching.entity.Match;
import com.careermatch.backend.matching.repository.MatchRepository;
import com.careermatch.backend.student.entity.Student;
import com.careermatch.backend.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MatchingService {

    private static final String CACHE_PREFIX = "matches::";
    private static final Duration CACHE_TTL   = Duration.ofHours(1);
    /** Number of RRF candidates fed into the deterministic scoring engine. */
    private static final int    TOP_CANDIDATES = 100;

    private final StudentRepository studentRepository;
    private final MatchRepository   matchRepository;
    private final SearchService     searchService;
    private final ScoringService    scoringService;
    private final GroqService       groqService;
    private final JobRepository     jobRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    // ──────────────────────────────────────────────────────────────────────────
    //  Core matching pipeline
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Runs the full hybrid RAG + scoring pipeline for a student:
     * 1. pgvector cosine search + BM25 FTS → RRF fusion (top-{@value TOP_CANDIDATES} candidates)
     * 2. Deterministic 6-factor ScoringService for each candidate
     * 3. Sort descending by composite score
     * 4. Persist all Match entities (upsert)
     * 5. Invalidate + repopulate Redis cache
     */
    @Transactional
    public List<Match> generateMatchesForStudent(UUID studentId) {
        log.info("Generating job matches for student: {} (top {} RRF candidates)", studentId, TOP_CANDIDATES);
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found: " + studentId));

        // Step 1: Hybrid search — pgvector + BM25 + RRF
        List<Job> topJobs = searchService.searchJobsForStudent(student, TOP_CANDIDATES);
        log.info("RRF returned {} candidate jobs for student {}.", topJobs.size(), studentId);

        // Step 2: Score and upsert all candidates
        List<Match> matches = new ArrayList<>();
        for (Job job : topJobs) {
            matches.add(generateMatchForStudentAndJob(student, job));
        }

        // Step 3: Sort highest score first (deterministic ranking)
        matches.sort((a, b) -> Double.compare(b.getCompositeScore(), a.getCompositeScore()));

        log.info("Scoring complete. {} matches generated for student {}. Top score: {}.",
                matches.size(), studentId,
                matches.isEmpty() ? "n/a" : matches.get(0).getCompositeScore());

        // Step 4: Refresh Redis cache
        refreshCache(studentId, matches);

        return matches;
    }

    @Transactional
    public Match generateMatchesForStudentAndJob(UUID studentId, Job job) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found: " + studentId));
        Match m = generateMatchForStudentAndJob(student, job);
        invalidateCache(studentId);
        return m;
    }

    @Transactional
    public Match generateMatchForStudentAndJob(Student student, Job job) {
        double score    = scoringService.calculateCompositeScore(student, job);
        boolean eligible = score >= 40.0;

        Optional<Match> existingOpt = matchRepository.findByStudentIdAndJobId(student.getId(), job.getId());
        Match match;
        if (existingOpt.isPresent()) {
            match = existingOpt.get();
            match.setScore(score);
            match.setCompositeScore(score);
            match.setEligibilityStatus(eligible);
        } else {
            match = Match.builder()
                    .student(student)
                    .job(job)
                    .score(score)
                    .compositeScore(score)
                    .eligibilityStatus(eligible)
                    .build();
        }
        Match saved;
        try {
            saved = matchRepository.saveAndFlush(match);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            Match existing = matchRepository.findByStudentIdAndJobId(student.getId(), job.getId()).orElse(match);
            existing.setScore(score);
            existing.setCompositeScore(score);
            existing.setEligibilityStatus(eligible);
            saved = matchRepository.save(existing);
        }
        invalidateCache(student.getId());
        return saved;
    }


    // ──────────────────────────────────────────────────────────────────────────
    //  Query — with Redis cache
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Returns the student's job matches sorted by composite score descending.
     * Results are served from Redis cache (TTL: 1 hour) when available.
     */
    @SuppressWarnings("unchecked")
    public List<Match> getMatchesForStudent(UUID studentId) {
        String cacheKey = CACHE_PREFIX + studentId;

        // Cache read
        try {
            Object cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached instanceof List) {
                List<?> list = (List<?>) cached;
                if (!list.isEmpty()) {
                    log.debug("Cache HIT for student {} matches.", studentId);
                    return (List<Match>) list;
                }
            }
        } catch (Exception e) {
            log.warn("Redis cache read failed for student {}: {}. Falling back to DB.", studentId, e.getMessage());
        }

        log.debug("Cache MISS for student {} — querying DB.", studentId);
        List<Match> matches = matchRepository
                .findByStudentIdOrderByCompositeScoreDesc(studentId)
                .stream()
                .filter(m -> m.getJob().getStatus() == JobStatus.ACTIVE)
                .filter(m -> m.getCompositeScore() >= 30.0)
                .collect(Collectors.toList());

        // On DB miss, if student has entered skills in profile (even without resume), auto-generate matches
        if (matches.isEmpty()) {
            log.info("No DB matches found for student {} — generating matches directly from student profile skills.", studentId);
            try {
                matches = generateMatchesForStudent(studentId).stream()
                        .filter(m -> m.getJob().getStatus() == JobStatus.ACTIVE)
                        .filter(m -> m.getCompositeScore() >= 30.0)
                        .collect(Collectors.toList());
            } catch (Exception e) {
                log.warn("Failed to auto-generate matches from profile for student {}: {}", studentId, e.getMessage());
            }
        }

        // Populate cache on miss
        if (!matches.isEmpty()) {
            populateCache(cacheKey, matches);
        }

        return matches;
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Filtered search (student job board with filters)
    // ──────────────────────────────────────────────────────────────────────────

    @Transactional
    public List<Match> searchJobsWithScores(
            UUID studentId,
            String location,
            String role,
            String experienceLevel,
            String jobType,
            String skills,
            String salary,
            Boolean sponsorship,
            String sortBy
    ) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found: " + studentId));

        List<Job> allJobs = jobRepository.findByStatus(JobStatus.ACTIVE);

        List<Match> filteredMatches = allJobs.stream()
                .filter(job -> matchesFilters(job, location, role, experienceLevel, jobType, skills, salary, sponsorship))
                .map(job -> {
                    Optional<Match> existing = matchRepository.findByStudentIdAndJobId(studentId, job.getId());
                    if (existing.isPresent()) {
                        return existing.get();
                    } else {
                        double score    = scoringService.calculateCompositeScore(student, job);
                        boolean eligible = score >= 40.0;
                        Match match = Match.builder()
                                .student(student)
                                .job(job)
                                .compositeScore(score)
                                .eligibilityStatus(eligible)
                                .build();
                        return matchRepository.save(match);
                    }
                })
                .collect(Collectors.toList());

        sortMatches(filteredMatches, sortBy);
        return filteredMatches;
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  AI enrichment
    // ──────────────────────────────────────────────────────────────────────────

    @Transactional
    public Match enrichMatchWithAi(UUID matchId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found: " + matchId));

        if (match.getExplanation() != null && match.getSkillGap() != null) {
            return match;
        }

        log.info("Enriching Match {} with AI insights...", matchId);

        StringBuilder profileSummary = new StringBuilder();
        profileSummary.append("Skills: ");
        match.getStudent().getSkills()
                .forEach(s -> profileSummary.append(s.getName()).append(", "));
        profileSummary.append("\nBio: ").append(match.getStudent().getBio());
        profileSummary.append("\nExperience: ");
        match.getStudent().getExperience()
                .forEach(e -> profileSummary.append(e.getJobTitle())
                        .append(" at ").append(e.getCompanyName()).append(". "));

        String jobDesc = match.getJob().getTitle() + "\n"
                + match.getJob().getDescription() + "\n"
                + match.getJob().getRequirements();

        match.setExplanation(groqService.explainMatch(profileSummary.toString(), jobDesc));
        match.setSkillGap(groqService.explainSkillGap(profileSummary.toString(), jobDesc));
        match.setCareerInsights("Focus on bridging the skill gap to increase your eligibility rating.");

        return matchRepository.save(match);
    }

    public String askAiAboutMatch(UUID matchId, String question) {
        Match enriched = enrichMatchWithAi(matchId);

        Map<String, Object> context = new HashMap<>();
        context.put("matchScore",        enriched.getCompositeScore());
        context.put("jobTitle",           enriched.getJob().getTitle());
        context.put("jobDescription",     enriched.getJob().getDescription());
        context.put("jobRequirements",    enriched.getJob().getRequirements());
        context.put("studentFirstName",   enriched.getStudent().getFirstName());
        context.put("studentSkills",      enriched.getStudent().getSkills().stream()
                .map(s -> s.getName()).collect(Collectors.toList()));
        context.put("studentEducation",   enriched.getStudent().getEducation());
        context.put("studentExperience",  enriched.getStudent().getExperience());
        context.put("studentProjects",    enriched.getStudent().getProjects());
        context.put("techFitScore",       scoringService.calculateTechnicalFit(enriched.getStudent(), enriched.getJob()));
        context.put("projectFitScore",    scoringService.calculateProjectFit(enriched.getStudent(), enriched.getJob()));
        context.put("experienceFitScore", scoringService.calculateExperienceFit(enriched.getStudent(), enriched.getJob()));
        context.put("domainFitScore",     scoringService.calculateDomainFit(enriched.getStudent(), enriched.getJob()));
        context.put("behavioralFitScore", scoringService.calculateBehavioralFit(enriched.getStudent(), enriched.getJob()));
        context.put("educationFitScore",  scoringService.calculateEduCertFit(enriched.getStudent()));

        String contextJson = "{}";
        try {
            contextJson = new com.fasterxml.jackson.databind.ObjectMapper()
                    .writeValueAsString(context);
        } catch (Exception e) {
            log.error("Failed to serialize AI chat context", e);
        }

        return groqService.askAiQuestion(contextJson, question);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Score delegates
    // ──────────────────────────────────────────────────────────────────────────

    public double calculateTechnicalFit(Student student, Job job)  { return scoringService.calculateTechnicalFit(student, job); }
    public double calculateProjectFit(Student student, Job job)    { return scoringService.calculateProjectFit(student, job); }
    public double calculateExperienceFit(Student student, Job job) { return scoringService.calculateExperienceFit(student, job); }
    public double calculateDomainFit(Student student, Job job)     { return scoringService.calculateDomainFit(student, job); }
    public double calculateBehavioralFit(Student student, Job job) { return scoringService.calculateBehavioralFit(student, job); }
    public double calculateEduCertFit(Student student)             { return scoringService.calculateEduCertFit(student); }

    // ──────────────────────────────────────────────────────────────────────────
    //  Redis helpers
    // ──────────────────────────────────────────────────────────────────────────

    private void refreshCache(UUID studentId, List<Match> matches) {
        String cacheKey = CACHE_PREFIX + studentId;
        invalidateCache(studentId);
        populateCache(cacheKey, matches);
    }

    private void populateCache(String cacheKey, List<Match> matches) {
        try {
            redisTemplate.opsForValue().set(cacheKey, matches, CACHE_TTL);
            log.debug("Redis cache populated for key '{}' with {} matches (TTL {}h).",
                    cacheKey, matches.size(), CACHE_TTL.toHours());
        } catch (Exception e) {
            log.warn("Redis cache write failed for key '{}': {}", cacheKey, e.getMessage());
        }
    }

    private void invalidateCache(UUID studentId) {
        String cacheKey = CACHE_PREFIX + studentId;
        try {
            redisTemplate.delete(cacheKey);
            log.debug("Invalidated Redis cache for student {}.", studentId);
        } catch (Exception e) {
            log.warn("Redis cache invalidation failed for student {}: {}", studentId, e.getMessage());
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  Filter + sort helpers
    // ──────────────────────────────────────────────────────────────────────────

    private boolean matchesFilters(Job job, String location, String role, String experienceLevel,
                                   String jobType, String skills, String salary, Boolean sponsorship) {
        if (location != null && !location.isBlank()) {
            String loc = job.getLocation() != null ? job.getLocation().toLowerCase() : "";
            if (!loc.contains(location.toLowerCase())) return false;
        }
        if (role != null && !role.isBlank()) {
            String title = job.getTitle() != null ? job.getTitle().toLowerCase() : "";
            if (!title.contains(role.toLowerCase())) return false;
        }
        if (experienceLevel != null && !experienceLevel.isBlank()) {
            String exp = job.getExperienceLevel() != null ? job.getExperienceLevel().toLowerCase() : "";
            if (!exp.contains(experienceLevel.toLowerCase())) return false;
        }
        if (jobType != null && !jobType.isBlank()) {
            if (!job.getJobType().name().equalsIgnoreCase(jobType)) return false;
        }
        if (skills != null && !skills.isBlank()) {
            String req  = job.getRequirements() != null ? job.getRequirements().toLowerCase() : "";
            String desc = job.getDescription()  != null ? job.getDescription().toLowerCase()  : "";
            String combined = req + " " + desc;
            for (String s : skills.split(",")) {
                if (!combined.contains(s.trim().toLowerCase())) return false;
            }
        }
        if (salary != null && !salary.isBlank()) {
            String salRange = job.getSalaryRange() != null ? job.getSalaryRange().toLowerCase() : "";
            if (!salRange.contains(salary.toLowerCase())) {
                try {
                    double querySal = Double.parseDouble(salary.replaceAll("[^0-9.]", ""));
                    double jobMinSal = parseMinSalary(salRange);
                    if (jobMinSal > 0 && jobMinSal < querySal) return false;
                } catch (Exception ignored) {
                    return false;
                }
            }
        }
        if (Boolean.TRUE.equals(sponsorship)) {
            String desc = job.getDescription() != null ? job.getDescription().toLowerCase() : "";
            String req  = job.getRequirements() != null ? job.getRequirements().toLowerCase() : "";
            String combined = desc + " " + req;
            if (!combined.contains("sponsor") && !combined.contains("visa") && !combined.contains("h1b")) {
                return false;
            }
        }
        return true;
    }

    private void sortMatches(List<Match> matches, String sortBy) {
        if (sortBy == null || sortBy.isBlank() || "BEST_MATCH".equalsIgnoreCase(sortBy)) {
            matches.sort((a, b) -> Double.compare(b.getCompositeScore(), a.getCompositeScore()));
        } else if ("LATEST".equalsIgnoreCase(sortBy)) {
            matches.sort((a, b) -> {
                LocalDateTime ta = a.getJob().getCreatedAt() != null ? a.getJob().getCreatedAt() : LocalDateTime.MIN;
                LocalDateTime tb = b.getJob().getCreatedAt() != null ? b.getJob().getCreatedAt() : LocalDateTime.MIN;
                return tb.compareTo(ta);
            });
        } else if ("SALARY".equalsIgnoreCase(sortBy)) {
            matches.sort((a, b) -> Double.compare(
                    parseMinSalary(b.getJob().getSalaryRange()),
                    parseMinSalary(a.getJob().getSalaryRange())));
        } else if ("EXPERIENCE".equalsIgnoreCase(sortBy)) {
            matches.sort((a, b) -> {
                String ea = a.getJob().getExperienceLevel() != null ? a.getJob().getExperienceLevel().toUpperCase() : "";
                String eb = b.getJob().getExperienceLevel() != null ? b.getJob().getExperienceLevel().toUpperCase() : "";
                return eb.compareTo(ea);
            });
        }
    }

    private double parseMinSalary(String salaryRange) {
        if (salaryRange == null || salaryRange.isBlank()) return 0.0;
        try {
            String cleaned = salaryRange.replaceAll("[^0-9–\\-.] ", "");
            String[] parts  = cleaned.split("[–\\-]");
            if (parts.length > 0 && !parts[0].isBlank()) {
                return Double.parseDouble(parts[0]);
            }
        } catch (Exception e) {
            log.debug("Could not parse min salary from: {}", salaryRange);
        }
        return 0.0;
    }
}
