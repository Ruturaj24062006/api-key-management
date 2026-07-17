package com.careermatch.backend.matching.service;

import com.careermatch.backend.ai.service.GroqService;
import com.careermatch.backend.exception.ResourceNotFoundException;
import com.careermatch.backend.job.entity.Job;
import com.careermatch.backend.matching.entity.Match;
import com.careermatch.backend.matching.repository.MatchRepository;
import com.careermatch.backend.student.entity.Student;
import com.careermatch.backend.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.careermatch.backend.job.repository.JobRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MatchingService {

    private final StudentRepository studentRepository;
    private final MatchRepository matchRepository;
    private final SearchService searchService;
    private final ScoringService scoringService;
    private final GroqService groqService;
    private final JobRepository jobRepository;

    @Transactional
    public List<Match> generateMatchesForStudent(UUID studentId) {
        log.info("Generating job matches for student: {}", studentId);
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found: " + studentId));

        // 1. Search top 20 jobs using hybrid search
        List<Job> topJobs = searchService.searchJobsForStudent(student, 20);
        List<Match> matches = new ArrayList<>();

        for (Job job : topJobs) {
            matches.add(generateMatchForStudentAndJob(student, job));
        }

        log.info("Successfully updated {} matches for student {}", matches.size(), studentId);
        return matches;
    }

    @Transactional
    public Match generateMatchesForStudentAndJob(UUID studentId, Job job) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found: " + studentId));
        return generateMatchForStudentAndJob(student, job);
    }

    @Transactional
    public Match generateMatchForStudentAndJob(Student student, Job job) {
        // Calculate composite scores
        double score = scoringService.calculateCompositeScore(student, job);
        boolean eligible = score >= 40.0; // threshold for eligibility

        // Save or update match
        Optional<Match> existingOpt = matchRepository.findByStudentIdAndJobId(student.getId(), job.getId());
        Match match;
        if (existingOpt.isPresent()) {
            match = existingOpt.get();
            match.setCompositeScore(score);
            match.setEligibilityStatus(eligible);
        } else {
            match = Match.builder()
                    .student(student)
                    .job(job)
                    .compositeScore(score)
                    .eligibilityStatus(eligible)
                    .build();
        }
        return matchRepository.save(match);
    }

    @Transactional
    public Match enrichMatchWithAi(UUID matchId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found: " + matchId));

        // Check if already enriched
        if (match.getExplanation() != null && match.getSkillGap() != null) {
            return match;
        }

        log.info("Enriching Match: {} with AI insights...", matchId);
        
        StringBuilder profileSummary = new StringBuilder();
        profileSummary.append("Skills: ");
        match.getStudent().getSkills().forEach(s -> profileSummary.append(s.getName()).append(", "));
        profileSummary.append("\nBio: ").append(match.getStudent().getBio());
        profileSummary.append("\nExperience: ");
        match.getStudent().getExperience().forEach(e -> profileSummary.append(e.getJobTitle()).append(" at ").append(e.getCompanyName()).append(". "));

        String jobDesc = match.getJob().getTitle() + "\n" + match.getJob().getDescription() + "\n" + match.getJob().getRequirements();

        // Call AI Groq explanations
        String explanation = groqService.explainMatch(profileSummary.toString(), jobDesc);
        String skillGapJson = groqService.explainSkillGap(profileSummary.toString(), jobDesc);

        match.setExplanation(explanation);
        match.setSkillGap(skillGapJson);
        match.setCareerInsights("Focus on bridging the skill gap to increase your eligibility rating.");

        return matchRepository.save(match);
    }

    public List<Match> getMatchesForStudent(UUID studentId) {
        return matchRepository.findByStudentIdOrderByCompositeScoreDesc(studentId).stream()
                .filter(m -> m.getJob().getStatus() == com.careermatch.backend.job.entity.JobStatus.ACTIVE)
                .collect(Collectors.toList());
    }

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

        List<Job> allJobs = jobRepository.findByStatus(com.careermatch.backend.job.entity.JobStatus.ACTIVE);

        List<Match> filteredMatches = allJobs.stream()
                .filter(job -> {
                    if (location != null && !location.isBlank()) {
                        String loc = job.getLocation() != null ? job.getLocation().toLowerCase() : "";
                        if (!loc.contains(location.toLowerCase())) {
                            return false;
                        }
                    }
                    if (role != null && !role.isBlank()) {
                        String title = job.getTitle() != null ? job.getTitle().toLowerCase() : "";
                        if (!title.contains(role.toLowerCase())) {
                            return false;
                        }
                    }
                    if (experienceLevel != null && !experienceLevel.isBlank()) {
                        String exp = job.getExperienceLevel() != null ? job.getExperienceLevel().toLowerCase() : "";
                        if (!exp.contains(experienceLevel.toLowerCase())) {
                            return false;
                        }
                    }
                    if (jobType != null && !jobType.isBlank()) {
                        if (!job.getJobType().name().equalsIgnoreCase(jobType)) {
                            return false;
                        }
                    }
                    if (skills != null && !skills.isBlank()) {
                        String req = job.getRequirements() != null ? job.getRequirements().toLowerCase() : "";
                        String desc = job.getDescription() != null ? job.getDescription().toLowerCase() : "";
                        String combine = req + " " + desc;
                        for (String s : skills.split(",")) {
                            if (!combine.contains(s.trim().toLowerCase())) {
                                return false;
                            }
                        }
                    }
                    if (salary != null && !salary.isBlank()) {
                        String salRange = job.getSalaryRange() != null ? job.getSalaryRange().toLowerCase() : "";
                        if (!salRange.contains(salary.toLowerCase())) {
                            try {
                                double querySal = Double.parseDouble(salary.replaceAll("[^0-9.]", ""));
                                double jobMinSal = parseMinSalary(salRange);
                                if (jobMinSal > 0 && jobMinSal < querySal) {
                                    return false;
                                }
                            } catch (Exception e) {
                                if (!salRange.contains(salary.toLowerCase())) {
                                    return false;
                                }
                            }
                        }
                    }
                    if (sponsorship != null && sponsorship) {
                        String desc = job.getDescription() != null ? job.getDescription().toLowerCase() : "";
                        String req = job.getRequirements() != null ? job.getRequirements().toLowerCase() : "";
                        String combine = desc + " " + req;
                        if (!combine.contains("sponsor") && !combine.contains("visa") && !combine.contains("h1b")) {
                            return false;
                        }
                    }
                    return true;
                })
                .map(job -> {
                    Optional<Match> existing = matchRepository.findByStudentIdAndJobId(studentId, job.getId());
                    if (existing.isPresent()) {
                        return existing.get();
                    } else {
                        double score = scoringService.calculateCompositeScore(student, job);
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

        // Sort results
        if (sortBy != null && !sortBy.isBlank()) {
            if ("BEST_MATCH".equalsIgnoreCase(sortBy)) {
                filteredMatches.sort((a, b) -> Double.compare(b.getCompositeScore(), a.getCompositeScore()));
            } else if ("LATEST".equalsIgnoreCase(sortBy)) {
                filteredMatches.sort((a, b) -> {
                    LocalDateTime ta = a.getJob().getCreatedAt() != null ? a.getJob().getCreatedAt() : LocalDateTime.MIN;
                    LocalDateTime tb = b.getJob().getCreatedAt() != null ? b.getJob().getCreatedAt() : LocalDateTime.MIN;
                    return tb.compareTo(ta);
                });
            } else if ("SALARY".equalsIgnoreCase(sortBy)) {
                filteredMatches.sort((a, b) -> {
                    double sa = parseMinSalary(a.getJob().getSalaryRange());
                    double sb = parseMinSalary(b.getJob().getSalaryRange());
                    return Double.compare(sb, sa);
                });
            } else if ("EXPERIENCE".equalsIgnoreCase(sortBy)) {
                filteredMatches.sort((a, b) -> {
                    String ea = a.getJob().getExperienceLevel() != null ? a.getJob().getExperienceLevel().toUpperCase() : "";
                    String eb = b.getJob().getExperienceLevel() != null ? b.getJob().getExperienceLevel().toUpperCase() : "";
                    return eb.compareTo(ea);
                });
            }
        } else {
            filteredMatches.sort((a, b) -> Double.compare(b.getCompositeScore(), a.getCompositeScore()));
        }

        return filteredMatches;
    }

    private double parseMinSalary(String salaryRange) {
        if (salaryRange == null || salaryRange.isBlank()) {
            return 0.0;
        }
        try {
            String cleaned = salaryRange.replaceAll("[^0-9–\\-.]", "");
            String[] parts = cleaned.split("[–\\-]");
            if (parts.length > 0 && !parts[0].isBlank()) {
                return Double.parseDouble(parts[0]);
            }
        } catch (Exception e) {
            log.debug("Failed to parse min salary range: {}", salaryRange);
        }
        return 0.0;
    }

    public double calculateTechnicalFit(Student student, Job job) {
        return scoringService.calculateTechnicalFit(student, job);
    }
    public double calculateProjectFit(Student student, Job job) {
        return scoringService.calculateProjectFit(student, job);
    }
    public double calculateExperienceFit(Student student, Job job) {
        return scoringService.calculateExperienceFit(student, job);
    }
    public double calculateDomainFit(Student student, Job job) {
        return scoringService.calculateDomainFit(student, job);
    }
    public double calculateBehavioralFit(Student student, Job job) {
        return scoringService.calculateBehavioralFit(student, job);
    }
    public double calculateEduCertFit(Student student) {
        return scoringService.calculateEduCertFit(student);
    }

    public String askAiAboutMatch(UUID matchId, String question) {
        Match enriched = enrichMatchWithAi(matchId);
        
        Map<String, Object> context = new HashMap<>();
        context.put("matchScore", enriched.getCompositeScore());
        context.put("jobTitle", enriched.getJob().getTitle());
        context.put("jobDescription", enriched.getJob().getDescription());
        context.put("jobRequirements", enriched.getJob().getRequirements());
        context.put("studentFirstName", enriched.getStudent().getFirstName());
        context.put("studentSkills", enriched.getStudent().getSkills().stream().map(s -> s.getName()).collect(Collectors.toList()));
        context.put("studentEducation", enriched.getStudent().getEducation());
        context.put("studentExperience", enriched.getStudent().getExperience());
        context.put("studentProjects", enriched.getStudent().getProjects());
        
        context.put("techFitScore", scoringService.calculateTechnicalFit(enriched.getStudent(), enriched.getJob()));
        context.put("projectFitScore", scoringService.calculateProjectFit(enriched.getStudent(), enriched.getJob()));
        context.put("experienceFitScore", scoringService.calculateExperienceFit(enriched.getStudent(), enriched.getJob()));
        context.put("domainFitScore", scoringService.calculateDomainFit(enriched.getStudent(), enriched.getJob()));
        context.put("behavioralFitScore", scoringService.calculateBehavioralFit(enriched.getStudent(), enriched.getJob()));
        context.put("educationFitScore", scoringService.calculateEduCertFit(enriched.getStudent()));

        String contextJson = "{}";
        try {
            contextJson = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(context);
        } catch (Exception e) {
            log.error("Failed to serialize chat context", e);
        }

        return groqService.askAiQuestion(contextJson, question);
    }
}
