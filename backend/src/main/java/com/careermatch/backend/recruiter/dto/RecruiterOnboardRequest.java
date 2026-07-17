package com.careermatch.backend.recruiter.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RecruiterOnboardRequest {
    @NotBlank(message = "Job title is required")
    private String jobTitle;

    @NotBlank(message = "Company name is required")
    private String companyName;

    private String logoUrl;
    private String websiteUrl;
    private String industry;
    private String location;
    private String description;
}
