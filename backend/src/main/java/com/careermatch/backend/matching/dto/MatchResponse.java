package com.careermatch.backend.matching.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class MatchResponse {
    private UUID id;
    private UUID jobId;
    private String jobTitle;
    private String companyName;
    private String location;
    private Double compositeScore;
    private boolean eligibilityStatus;
    private String salaryRange;
    private String jobType;
}
