package com.careermatch.backend.matching.service;

import com.careermatch.backend.job.entity.Job;
import com.careermatch.backend.student.entity.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ScoringService {

    public double calculateCompositeScore(Student student, Job job) {
        double techFit = calculateTechnicalFit(student, job);            // 40%
        double projectFit = calculateProjectFit(student, job);          // 20%
        double expFit = calculateExperienceFit(student, job);            // 15%
        double domainFit = calculateDomainFit(student, job);            // 10%
        double behavioralFit = calculateBehavioralFit(student, job);    // 10%
        double eduCertFit = calculateEduCertFit(student);               // 5%

        double composite = techFit + projectFit + expFit + domainFit + behavioralFit + eduCertFit;

        // Domain & Skill Mismatch Guard:
        // If student profile has skills listed, but techFit and domainFit are both 0 (meaning zero overlap in skills and domain),
        // then cap composite score to 0.0 so irrelevant jobs (e.g. Backend Dev shown to Marketing student) are filtered out.
        boolean hasSkills = student.getSkills() != null && !student.getSkills().isEmpty();
        if (hasSkills && techFit < 0.1 && domainFit < 0.1) {
            log.info("Domain mismatch detected between student {} skills and job {}: capping score to 0.", student.getId(), job.getId());
            composite = 0.0;
        }

        log.info("Scoring student {} for Job {}: Tech={}, Proj={}, Exp={}, Dom={}, Behav={}, EduCert={}, Total={}",
                student.getId(), job.getId(), techFit, projectFit, expFit, domainFit, behavioralFit, eduCertFit, composite);
        
        return Math.round(composite * 10.0) / 10.0; // round to 1 decimal place
    }

    // Technical Fit (40%) - Skill tags overlap
    public double calculateTechnicalFit(Student student, Job job) {
        if (student.getSkills() == null || student.getSkills().isEmpty()) {
            return 0.0;
        }

        String requirements = (job.getRequirements() != null ? job.getRequirements() : "").toLowerCase();
        String description = (job.getDescription() != null ? job.getDescription() : "").toLowerCase();
        String title = (job.getTitle() != null ? job.getTitle() : "").toLowerCase();
        String jobText = title + " " + requirements + " " + description;

        Set<String> studentSkills = student.getSkills().stream()
                .map(s -> s.getName().toLowerCase().trim())
                .collect(Collectors.toSet());

        long matchCount = studentSkills.stream()
                .filter(s -> !s.isBlank() && jobText.contains(s))
                .count();

        double ratio = (double) matchCount / Math.max(5.0, studentSkills.size());
        return Math.min(40.0, ratio * 40.0);
    }

    // Project Fit (20%) - Project technologies / descriptions matching job
    public double calculateProjectFit(Student student, Job job) {
        if (student.getProjects() == null || student.getProjects().isEmpty()) {
            return 0.0;
        }

        String jobText = (job.getTitle() + " " + job.getDescription() + " " + job.getRequirements()).toLowerCase();
        long matches = 0;

        for (StudentProject project : student.getProjects()) {
            String tech = (project.getTechnologies() != null ? project.getTechnologies() : "").toLowerCase();
            String desc = (project.getDescription() != null ? project.getDescription() : "").toLowerCase();
            
            if (jobText.contains(project.getName().toLowerCase()) || 
                (!tech.isBlank() && jobText.contains(tech)) ||
                (!desc.isBlank() && jobText.contains(desc))) {
                matches++;
            }
        }

        double ratio = (double) matches / student.getProjects().size();
        return ratio * 20.0;
    }

    // Experience Fit (15%) - Years of experience vs job requirements
    public double calculateExperienceFit(Student student, Job job) {
        double years = calculateYearsOfExperience(student);
        String expLevel = job.getExperienceLevel() != null ? job.getExperienceLevel().toUpperCase() : "ENTRY_LEVEL";

        if (expLevel.contains("SENIOR")) {
            if (years >= 5.0) return 15.0;
            return (years / 5.0) * 15.0;
        } else if (expLevel.contains("MID")) {
            if (years >= 2.0) return 15.0;
            return (years / 2.0) * 15.0;
        } else {
            // Entry Level
            return 15.0;
        }
    }

    // Domain Fit (10%) - Overlap of major/education, experience domain, skills, and preferences with job title
    public double calculateDomainFit(Student student, Job job) {
        String jobTitle = (job.getTitle() != null ? job.getTitle() : "").toLowerCase();
        String jobReqs = (job.getRequirements() != null ? job.getRequirements() : "").toLowerCase();
        String jobFull = jobTitle + " " + jobReqs;
        double score = 0.0;

        // Check education major domain
        if (student.getEducation() != null) {
            for (StudentEducation edu : student.getEducation()) {
                String field = edu.getFieldOfStudy() != null ? edu.getFieldOfStudy().toLowerCase() : "";
                if (!field.isBlank()) {
                    for (String token : field.split("[\\s,/]+")) {
                        if (token.length() > 3 && jobFull.contains(token)) {
                            score = Math.max(score, 10.0);
                            break;
                        }
                    }
                }
            }
        }

        // Check skills for domain match (e.g. marketing skills matching marketing job)
        if (student.getSkills() != null) {
            for (StudentSkill skill : student.getSkills()) {
                String sName = skill.getName() != null ? skill.getName().toLowerCase() : "";
                if (!sName.isBlank() && jobFull.contains(sName)) {
                    score = Math.max(score, 10.0);
                    break;
                }
            }
        }

        // Check experience titles domain & career preferences
        if (student.getExperience() != null) {
            for (StudentExperience exp : student.getExperience()) {
                String title = exp.getJobTitle() != null ? exp.getJobTitle().toLowerCase() : "";
                if (!title.isBlank()) {
                    for (String token : title.split("[\\s,/]+")) {
                        if (token.length() > 3 && jobFull.contains(token)) {
                            score = Math.max(score, 10.0);
                            break;
                        }
                    }
                }
            }
        }

        if (student.getCareerPreferences() != null && !student.getCareerPreferences().isBlank()) {
            String prefs = student.getCareerPreferences().toLowerCase();
            for (String token : prefs.split("[\\s,/]+")) {
                if (token.length() > 3 && jobFull.contains(token)) {
                    score = Math.max(score, 10.0);
                    break;
                }
            }
        }

        return score;
    }

    // Behavioral Fit (10%) - Soft skills keyword matching
    public double calculateBehavioralFit(Student student, Job job) {
        String searchArea = ((student.getBio() != null ? student.getBio() : "") + " " + 
                student.getExperience().stream().map(e -> e.getDescription() != null ? e.getDescription() : "").collect(Collectors.joining(" "))).toLowerCase();

        String[] keywords = {"teamwork", "leadership", "communication", "problem solving", "organization", "agile", "scrum", "collaboration", "adaptability"};
        long matches = 0;

        for (String kw : keywords) {
            if (searchArea.contains(kw)) {
                matches++;
            }
        }

        // Target: matches at least 3 behavioral keywords for full points
        double ratio = (double) matches / 3.0;
        return Math.min(10.0, ratio * 10.0);
    }

    // Education & Certifications Fit (5%)
    public double calculateEduCertFit(Student student) {
        double score = 0.0;

        // GPA component (2.5%)
        if (student.getEducation() != null && !student.getEducation().isEmpty()) {
            double maxGpa = student.getEducation().stream()
                    .filter(e -> e.getGpa() != null)
                    .mapToDouble(StudentEducation::getGpa)
                    .max()
                    .orElse(0.0);

            if (maxGpa >= 3.5) {
                score += 2.5;
            } else if (maxGpa >= 3.0) {
                score += 1.5;
            }
        }

        // Certifications component (2.5%)
        if (student.getCertifications() != null && !student.getCertifications().isEmpty()) {
            score += 2.5;
        }

        return score;
    }

    private double calculateYearsOfExperience(Student student) {
        if (student.getExperience() == null || student.getExperience().isEmpty()) {
            return 0.0;
        }

        long totalDays = 0;
        for (StudentExperience exp : student.getExperience()) {
            LocalDate start = exp.getStartDate();
            LocalDate end = exp.getEndDate() != null ? exp.getEndDate() : LocalDate.now();
            if (start != null) {
                totalDays += ChronoUnit.DAYS.between(start, end);
            }
        }
        return (double) totalDays / 365.25;
    }
}
