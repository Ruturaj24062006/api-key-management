package com.careermatch.backend.admin.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class AdminJobResponse {
    private UUID id;
    private String title;
    private String companyName;
    private String workMode;
    private String location;
    private String status;
    private LocalDateTime createdAt;
}
