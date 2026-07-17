package com.careermatch.backend.job.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class JobResponse {
    private UUID id;
    private String companyName;
    private String title;
    private String description;
    private String requirements;
    private String location;
    private String jobType;
    private String experienceLevel;
    private String salaryRange;
    private String requiredSkills;
    private String preferredSkills;
    private String workMode;
    private String educationLevel;
    private Boolean sponsorshipAvailable;
    private String status;
    private LocalDateTime createdAt;
}

