package com.careermatch.backend.admin.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AdminStatsResponse {
    private long studentCount;
    private long recruiterCount;
    private long companyCount;
    private long jobCount;
    private long applicationCount;
}
