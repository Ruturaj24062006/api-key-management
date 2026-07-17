package com.careermatch.backend.recruiter.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class RecruiterProfileResponse {
    private UUID id;
    private String email;
    private String jobTitle;
    private boolean isVerified;
    private UUID companyId;
    private String companyName;
    private String logoUrl;
    private String websiteUrl;
    private String industry;
    private String location;
    private String description;
}
