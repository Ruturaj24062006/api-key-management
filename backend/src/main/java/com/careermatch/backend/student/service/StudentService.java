package com.careermatch.backend.student.service;

import com.careermatch.backend.exception.BadRequestException;
import com.careermatch.backend.exception.ResourceNotFoundException;
import com.careermatch.backend.student.dto.*;
import com.careermatch.backend.student.entity.*;
import com.careermatch.backend.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StudentService {

    private final StudentRepository studentRepository;

    @Transactional(readOnly = true)
    public StudentProfileDto getProfile(UUID studentId) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found for ID: " + studentId));

        return mapToDto(student);
    }

    @Transactional
    public StudentProfileDto updateProfile(UUID studentId, StudentProfileDto dto) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found for ID: " + studentId));

        // 1. Basic Info
        student.setFirstName(dto.getFirstName());
        student.setLastName(dto.getLastName());
        student.setBio(dto.getBio());
        student.setGithubUrl(dto.getGithubUrl());
        student.setLinkedinUrl(dto.getLinkedinUrl());
        student.setPortfolioUrl(dto.getPortfolioUrl());
        student.setCareerPreferences(dto.getCareerPreferences());
        student.setLanguages(dto.getLanguages());

        // 2. Clear and Update collections to ensure clean mapping
        // Skills
        student.getSkills().clear();
        if (dto.getSkills() != null) {
            List<StudentSkill> newSkills = dto.getSkills().stream()
                    .map(s -> StudentSkill.builder()
                            .student(student)
                            .name(s.getName())
                            .proficiencyLevel(s.getProficiencyLevel())
                            .build())
                    .collect(Collectors.toList());
            student.getSkills().addAll(newSkills);
        }

        // Education
        student.getEducation().clear();
        if (dto.getEducation() != null) {
            List<StudentEducation> newEducation = dto.getEducation().stream()
                    .map(e -> StudentEducation.builder()
                            .student(student)
                            .institution(e.getInstitution())
                            .degree(e.getDegree())
                            .fieldOfStudy(e.getFieldOfStudy())
                            .startDate(e.getStartDate())
                            .endDate(e.getEndDate())
                            .gpa(e.getGpa())
                            .build())
                    .collect(Collectors.toList());
            student.getEducation().addAll(newEducation);
        }

        // Experience
        student.getExperience().clear();
        if (dto.getExperience() != null) {
            List<StudentExperience> newExp = dto.getExperience().stream()
                    .map(e -> StudentExperience.builder()
                            .student(student)
                            .companyName(e.getCompanyName())
                            .jobTitle(e.getJobTitle())
                            .startDate(e.getStartDate())
                            .endDate(e.getEndDate())
                            .description(e.getDescription())
                            .build())
                    .collect(Collectors.toList());
            student.getExperience().addAll(newExp);
        }

        // Projects
        student.getProjects().clear();
        if (dto.getProjects() != null) {
            List<StudentProject> newProj = dto.getProjects().stream()
                    .map(p -> StudentProject.builder()
                            .student(student)
                            .name(p.getName())
                            .description(p.getDescription())
                            .repoUrl(p.getRepoUrl())
                            .technologies(p.getTechnologies())
                            .build())
                    .collect(Collectors.toList());
            student.getProjects().addAll(newProj);
        }

        // 3. Compute dynamic completion percentage
        int pct = calculateCompletionPercentage(student);
        student.setProfileCompletedPct(pct);

        Student saved = studentRepository.save(student);
        log.info("Saved profile updates for student {}. Completeness is {}%", studentId, pct);
        return mapToDto(saved);
    }

    private int calculateCompletionPercentage(Student s) {
        int pct = 0;

        // Basic Info: 20%
        if (s.getFirstName() != null && !s.getFirstName().isBlank()) pct += 5;
        if (s.getLastName() != null && !s.getLastName().isBlank()) pct += 5;
        if (s.getBio() != null && !s.getBio().isBlank()) pct += 5;
        if ((s.getLinkedinUrl() != null && !s.getLinkedinUrl().isBlank()) ||
            (s.getGithubUrl() != null && !s.getGithubUrl().isBlank()) ||
            (s.getPortfolioUrl() != null && !s.getPortfolioUrl().isBlank())) {
            pct += 5;
        }

        // Education: 20%
        if (s.getEducation() != null && !s.getEducation().isEmpty()) {
            pct += 20;
        }

        // Skills: 15%
        if (s.getSkills() != null && !s.getSkills().isEmpty()) {
            pct += 15;
        }

        // Experience: 15%
        if (s.getExperience() != null && !s.getExperience().isEmpty()) {
            pct += 15;
        }

        // Projects: 15%
        if (s.getProjects() != null && !s.getProjects().isEmpty()) {
            pct += 15;
        }

        // Career Preferences (10%) & Languages (5%): 15%
        if (s.getCareerPreferences() != null && !s.getCareerPreferences().isBlank()) {
            pct += 10;
        }
        if (s.getLanguages() != null && !s.getLanguages().isBlank()) {
            pct += 5;
        }

        return pct;
    }

    private StudentProfileDto mapToDto(Student student) {
        List<SkillDto> skills = student.getSkills() != null ? student.getSkills().stream()
                .map(s -> SkillDto.builder()
                        .name(s.getName())
                        .proficiencyLevel(s.getProficiencyLevel())
                        .build())
                .collect(Collectors.toList()) : new ArrayList<>();

        List<ProjectDto> projects = student.getProjects() != null ? student.getProjects().stream()
                .map(p -> ProjectDto.builder()
                        .name(p.getName())
                        .description(p.getDescription())
                        .repoUrl(p.getRepoUrl())
                        .technologies(p.getTechnologies())
                        .build())
                .collect(Collectors.toList()) : new ArrayList<>();

        List<ExperienceDto> experience = student.getExperience() != null ? student.getExperience().stream()
                .map(e -> ExperienceDto.builder()
                        .companyName(e.getCompanyName())
                        .jobTitle(e.getJobTitle())
                        .startDate(e.getStartDate())
                        .endDate(e.getEndDate())
                        .description(e.getDescription())
                        .build())
                .collect(Collectors.toList()) : new ArrayList<>();

        List<EducationDto> education = student.getEducation() != null ? student.getEducation().stream()
                .map(e -> EducationDto.builder()
                        .institution(e.getInstitution())
                        .degree(e.getDegree())
                        .fieldOfStudy(e.getFieldOfStudy())
                        .startDate(e.getStartDate())
                        .endDate(e.getEndDate())
                        .gpa(e.getGpa())
                        .build())
                .collect(Collectors.toList()) : new ArrayList<>();

        String email = student.getUser() != null ? student.getUser().getEmail() : "";
        String defaultName = (email != null && email.contains("@")) ? email.split("@")[0] : "Student";
        String fName = (student.getFirstName() != null && !student.getFirstName().isBlank())
                ? student.getFirstName()
                : defaultName;
        String lName = (student.getLastName() != null) ? student.getLastName() : "";

        return StudentProfileDto.builder()
                .firstName(fName)
                .lastName(lName)
                .bio(student.getBio())
                .githubUrl(student.getGithubUrl())
                .linkedinUrl(student.getLinkedinUrl())
                .portfolioUrl(student.getPortfolioUrl())
                .careerPreferences(student.getCareerPreferences())
                .languages(student.getLanguages())
                .profileCompletedPct(student.getProfileCompletedPct())
                .skills(skills)
                .projects(projects)
                .experience(experience)
                .education(education)
                .build();
    }
}
