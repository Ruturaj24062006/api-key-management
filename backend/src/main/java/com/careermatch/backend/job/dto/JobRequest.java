package com.careermatch.backend.job.dto;

import com.careermatch.backend.job.entity.JobType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class JobRequest {
    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Description is required")
    private String description;

    private String requirements;
    private String location;

    @NotNull(message = "Job type is required")
    private JobType jobType;

    private String experienceLevel;
    private String salaryRange;
    private String requiredSkills;
    private String preferredSkills;
    private String workMode;
    private String educationLevel;
    private Boolean sponsorshipAvailable;
}

