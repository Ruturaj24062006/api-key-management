package com.careermatch.backend.matching.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class MatchDetailsResponse {
    private UUID id;
    private UUID jobId;
    private String jobTitle;
    private String companyName;
    private String location;
    private String jobDescription;
    private String jobRequirements;
    private Double compositeScore;
    private boolean eligibilityStatus;
    private String explanation;
    private String skillGap; // JSON string
    private String careerInsights;

    // Score breakdown
    private Double techFit;
    private Double projectFit;
    private Double expFit;
    private Double domainFit;
    private Double behavioralFit;
    private Double eduCertFit;
}
