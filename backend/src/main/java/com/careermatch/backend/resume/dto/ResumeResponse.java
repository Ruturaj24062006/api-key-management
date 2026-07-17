package com.careermatch.backend.resume.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class ResumeResponse {
    private UUID id;
    private String fileUrl;
    private boolean isCurrent;
    private String parsedText;
    private String extractedJson;
    private LocalDateTime createdAt;
}
