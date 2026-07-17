package com.careermatch.backend.application.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class ApplicationResponse {
    private UUID id;
    private UUID jobId;
    private UUID studentId;
    private String jobTitle;
    private String companyName;
    private String studentName;
    private String resumeUrl;
    private String status;
    private String coverLetter;
    private String feedback;
    private LocalDateTime createdAt;

    // Match metrics for recruiter-side ranking
    private Double matchScore;
    private Double technicalFit;
    private Double projectFit;
    private Double experienceFit;
    private Double domainFit;
    private Double behavioralFit;
    private Double educationFit;
}

