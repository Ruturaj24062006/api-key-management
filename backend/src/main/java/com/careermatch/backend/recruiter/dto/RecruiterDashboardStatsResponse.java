package com.careermatch.backend.recruiter.dto;

import com.careermatch.backend.application.dto.ApplicationResponse;
import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class RecruiterDashboardStatsResponse {
    private long activeJobs;
    private long totalApplications;
    private long shortlisted;
    private long interviews;
    private List<ApplicationResponse> recentApplications;
}
