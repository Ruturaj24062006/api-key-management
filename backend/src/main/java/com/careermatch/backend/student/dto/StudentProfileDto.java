package com.careermatch.backend.student.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentProfileDto {
    private String firstName;
    private String lastName;
    private String bio;
    private String githubUrl;
    private String linkedinUrl;
    private String portfolioUrl;
    private String careerPreferences;
    private String languages;
    private int profileCompletedPct;
    private List<SkillDto> skills;
    private List<ProjectDto> projects;
    private List<ExperienceDto> experience;
    private List<EducationDto> education;
}
